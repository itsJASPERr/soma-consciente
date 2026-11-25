"""Verify production search readiness and ensure previews omit analytics."""

import argparse
import re
import time
import xml.etree.ElementTree as ElementTree
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
from urllib.robotparser import RobotFileParser
from uuid import uuid4

ORIGIN = 'https://soma-consciente.com'
SITEMAP_INDEX = ORIGIN + '/sitemap-index.xml'
NAMESPACE = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
USER_AGENT = 'SOMA Deployment Check/1.0 (+https://soma-consciente.com/)'
NOINDEX = re.compile(r'\bnoindex\b', re.IGNORECASE)


class SearchMetadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.og_urls = []
        self.robots = []
        self.umami = 0
        self.cloudflare = 0
        self.analytics_scripts = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('property') == 'og:url':
            self.og_urls.append(attrs.get('content'))
        if tag == 'meta' and attrs.get('name', '').lower() in ('robots', 'googlebot'):
            self.robots.append(attrs.get('content', ''))
        if tag == 'script':
            src = urlsplit(attrs.get('src') or '')
            hostname = src.hostname or ''
            if hostname.endswith('.umami.is') or 'data-website-id' in attrs:
                self.analytics_scripts.add('Umami')
            if 'data-cf-beacon' in attrs or hostname.endswith('.cloudflareinsights.com'):
                self.analytics_scripts.add('Cloudflare Web Analytics')
            if (hostname == 'cloud.umami.is' and src.path == '/script.js'
                    and attrs.get('data-website-id') == '41a6c926-f20e-4490-80f4-fc75e59ddfa3'):
                self.umami += 1
            if hostname == 'static.cloudflareinsights.com' and src.path.startswith('/beacon.min.js'):
                self.cloudflare += 1


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, accept='*/*'):
    return Request(url, headers={'User-Agent': USER_AGENT, 'Accept': accept})


def fetch(url, accept='*/*'):
    with urlopen(request(url, accept), timeout=12) as response:
        assert response.status == 200, f'{url} returned HTTP {response.status}.'
        assert response.url == url, f'{url} redirects to {response.url}.'
        body = response.read().decode(response.headers.get_content_charset() or 'utf-8')
        return body, response.headers


def sitemap_locations(url, kind, entry):
    parts = urlsplit(url)
    assert parts.scheme == 'https' and parts.netloc == 'soma-consciente.com', f'Unexpected sitemap URL: {url}'
    body, headers = fetch(url)
    assert 'xml' in headers.get_content_type(), f'{url} did not serve XML.'
    root = ElementTree.fromstring(body)
    assert root.tag == NAMESPACE + kind, f'{url} is not a {kind}.'
    locations = [item.text.strip() for item in root.findall(f'{NAMESPACE}{entry}/{NAMESPACE}loc') if item.text]
    assert locations, f'{url} has no entries.'
    return locations


def check_page(url):
    parts = urlsplit(url)
    assert parts.scheme == 'https' and parts.netloc == 'soma-consciente.com', f'Unexpected page URL: {url}'
    assert not parts.query and not parts.fragment, f'The sitemap links to a URL variant: {url}'

    html, headers = fetch(url, 'text/html')
    assert headers.get_content_type() == 'text/html', f'{url} did not serve HTML.'
    metadata = SearchMetadata()
    metadata.feed(html)
    assert metadata.canonicals == [url], f'{url} declares canonical URLs {metadata.canonicals}.'
    assert metadata.og_urls == [url], f'{url} declares Open Graph URLs {metadata.og_urls}.'
    assert metadata.umami == 1, f'{url} serves {metadata.umami} SOMA Umami trackers.'
    assert metadata.cloudflare == 1, f'{url} serves {metadata.cloudflare} Cloudflare Web Analytics beacons.'
    directives = metadata.robots + headers.get_all('X-Robots-Tag', [])
    assert not any(NOINDEX.search(rule) for rule in directives), f'{url} is marked noindex.'


def check_status(url, expected):
    try:
        with build_opener(NoRedirect()).open(request(url), timeout=12) as response:
            status, headers = response.status, response.headers
    except HTTPError as error:
        status, headers = error.code, error.headers
        error.close()
    assert status in expected, f'{url} returned HTTP {status}, expected {expected}.'
    return headers


def verify():
    maps = sitemap_locations(SITEMAP_INDEX, 'sitemapindex', 'sitemap')
    pages = [page for url in maps for page in sitemap_locations(url, 'urlset', 'url')]
    assert len(pages) == len(set(pages)), 'The sitemap contains duplicate pages.'
    assert ORIGIN + '/' in pages, 'The sitemap is missing the homepage.'

    robots, _ = fetch(ORIGIN + '/robots.txt')
    policy = RobotFileParser()
    policy.parse(robots.splitlines())
    assert SITEMAP_INDEX in (policy.site_maps() or []), 'robots.txt is missing the sitemap index.'
    blocked = [page for page in pages if not policy.can_fetch('Googlebot', page)]
    assert not blocked, f'robots.txt blocks sitemap pages for Googlebot: {blocked}.'

    www = 'https://www.soma-consciente.com/biblioteca/'
    redirect = check_status(www, (301, 308)).get('Location', '')
    assert urljoin(www, redirect) == ORIGIN + '/biblioteca/', f'Unexpected www redirect: {redirect}'
    check_status(f'{ORIGIN}/soma-ci-missing-{uuid4().hex}/', (404, 410))

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check_page, pages))
    print(f'Live sitemap, robots.txt, redirects, metadata and analytics verified for {len(pages)} public pages.')


def check_no_analytics(html, location):
    metadata = SearchMetadata()
    metadata.feed(html)
    assert not metadata.analytics_scripts, f'{location} serves {", ".join(sorted(metadata.analytics_scripts))}.'


def preview_files():
    dist = Path('dist')
    assert (dist / 'index.html').is_file(), 'The preview build is missing its homepage.'
    return dist, sorted(dist.rglob('*.html'))


def verify_preview_build():
    _, pages = preview_files()
    for page in pages:
        check_no_analytics(page.read_text(encoding='utf-8'), page)
    print(f'No analytics trackers in {len(pages)} built preview pages.')


def verify_preview(origin):
    dist, pages = preview_files()
    paths = [
        path.relative_to(dist).as_posix().removesuffix('index.html')
        for path in pages
        if path != dist / '404.html'
    ]

    def check_preview_page(path):
        url = urljoin(origin, quote(path))
        html, headers = fetch(url, 'text/html')
        assert headers.get_content_type() == 'text/html', f'{url} did not serve HTML.'
        check_no_analytics(html, url)

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check_preview_page, paths))
    # The missing-page response may be rendered by a different edge route.
    missing = urljoin(origin, f'soma-ci-missing-{uuid4().hex}/')
    try:
        fetch(missing, 'text/html')
    except HTTPError as error:
        try:
            assert error.code == 404, f'{missing} returned HTTP {error.code}, expected 404.'
            check_no_analytics(error.read().decode(error.headers.get_content_charset() or 'utf-8'), missing)
        finally:
            error.close()
    else:
        raise AssertionError(f'{missing} returned HTTP 200, expected 404.')
    print(f'No analytics trackers on {len(paths)} deployed preview pages or the 404 response.')


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    modes = cli.add_mutually_exclusive_group()
    modes.add_argument('--preview-build', action='store_true', help='Check HTML in dist before deploying a preview.')
    modes.add_argument('--preview', metavar='URL', help='Check the deployed preview using routes from dist.')
    args = cli.parse_args()
    if args.preview_build:
        verify_preview_build()
        raise SystemExit(0)

    check_name = 'Preview analytics' if args.preview else 'Production search'
    # The newest artifact may take a few seconds to reach the public edge.
    for delay in (5, 10, 20, None):
        try:
            if args.preview:
                verify_preview(args.preview)
            else:
                verify()
            break
        except (AssertionError, ElementTree.ParseError, URLError, TimeoutError) as error:
            if delay is None:
                raise SystemExit(f'{check_name} verification failed: {error}') from error
            print(f'Waiting {delay}s before retrying the {check_name.lower()} check: {error}', flush=True)
            time.sleep(delay)
