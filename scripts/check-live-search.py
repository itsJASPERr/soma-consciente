"""Verify the public URLs that search engines see after a production deployment."""

import re
import time
import xml.etree.ElementTree as ElementTree
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
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

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('property') == 'og:url':
            self.og_urls.append(attrs.get('content'))
        if tag == 'meta' and attrs.get('name', '').lower() in ('robots', 'googlebot'):
            self.robots.append(attrs.get('content', ''))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url):
    return Request(url, headers={'User-Agent': USER_AGENT})


def fetch(url):
    with urlopen(request(url), timeout=12) as response:
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

    html, headers = fetch(url)
    assert headers.get_content_type() == 'text/html', f'{url} did not serve HTML.'
    metadata = SearchMetadata()
    metadata.feed(html)
    assert metadata.canonicals == [url], f'{url} declares canonical URLs {metadata.canonicals}.'
    assert metadata.og_urls == [url], f'{url} declares Open Graph URLs {metadata.og_urls}.'
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
    print(f'Live sitemap, robots.txt, redirects and metadata verified for {len(pages)} public pages.')


if __name__ == '__main__':
    # The newest artifact may take a few seconds to reach the public edge.
    for delay in (5, 10, 20, None):
        try:
            verify()
            break
        except (AssertionError, ElementTree.ParseError, URLError, TimeoutError) as error:
            if delay is None:
                raise SystemExit(f'Production search verification failed: {error}') from error
            print(f'Waiting {delay}s before retrying the production search check: {error}', flush=True)
            time.sleep(delay)
