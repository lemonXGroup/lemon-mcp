#!/usr/bin/env python3
"""Bounded, authenticated Lemon WebControl requests using only Python stdlib."""
import argparse
import base64
import getpass
import http.client
import json
import math
import os
from pathlib import Path
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import warnings

MAX_REQUEST_BYTES = 16 * 1024 * 1024
DEFAULT_RESPONSE_BYTES = 4 * 1024 * 1024


class ClientError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def target_url(base_url, path, query):
    try:
        base = urllib.parse.urlsplit(base_url)
        valid = (base.scheme in ('http', 'https') and base.hostname
                 and base.username is None and base.password is None
                 and base.path in ('', '/') and not base.query and not base.fragment)
        base.port  # Validate the port before attaching authentication.
    except ValueError:
        valid = False
    if not valid:
        raise ClientError('Base URL must be an explicit http(s) origin with no credentials or path.')
    if not path.startswith('/api/') or '?' in path or '#' in path or '\\' in path:
        raise ClientError('Use a /api/ path and pass query values with --query.')
    pairs = []
    for item in query:
        key, sep, value = item.partition('=')
        if not sep or not key:
            raise ClientError('Each --query must be KEY=VALUE.')
        if key.lower() in ('token', 'access_token', 'authorization', 'x-lemon-webcontrol-token'):
            raise ClientError('Authentication belongs in the request header, never the URL.')
        pairs.append((key, value))
    return urllib.parse.urlunsplit((base.scheme, base.netloc, path,
                                    urllib.parse.urlencode(pairs), ''))


def read_token(args):
    if args.prompt_token:
        if not sys.stdin.isatty():
            raise ClientError('--prompt-token needs a user-operated interactive terminal.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            try:
                token = getpass.getpass('Current Lemon Remote Controller token (hidden): ')
            except (getpass.GetPassWarning, EOFError):
                raise ClientError('Hidden input is unavailable; use protected credential injection.') from None
    elif args.token_file:
        token_path = Path(args.token_file)
        info = token_path.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_size > 4096:
            raise ClientError('Token file must be a small regular file.')
        if os.name == 'posix' and info.st_mode & 0o077:
            raise ClientError('Token file permissions must be 0600 or stricter.')
        token = token_path.read_text(encoding='utf-8')
    else:
        token = os.environ.get('LEMON_WEB_CONTROL_TOKEN', '')
    token = token.strip()
    if not token or '\r' in token or '\n' in token:
        raise ClientError('Provide the current token via LEMON_WEB_CONTROL_TOKEN, --token-file, or --prompt-token.')
    return token


def bounded_file(path):
    with Path(path).open('rb') as source:
        data = source.read(MAX_REQUEST_BYTES + 1)
    if len(data) > MAX_REQUEST_BYTES:
        raise ClientError('Request file exceeds 16 MiB.')
    return data


def request_body(args):
    if args.json_file:
        data = bounded_file(args.json_file)
        try:
            json.loads(data)
        except (ValueError, UnicodeError):
            raise ClientError('--json-file must contain valid UTF-8 JSON.') from None
        return data, 'application/json'
    if args.upload_file:
        if args.method != 'POST' or args.path != '/api/files/upload':
            raise ClientError('--upload-file is only for POST /api/files/upload.')
        name = Path(args.upload_file).name
        if any(c in name for c in '\r\n"\\'):
            raise ClientError('Upload filename contains unsupported characters.')
        boundary = 'LemonSkill' + uuid.uuid4().hex
        data = (('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="'
                 + name + '"\r\nContent-Type: application/octet-stream\r\n\r\n').encode('utf-8')
                + bounded_file(args.upload_file) + ('\r\n--' + boundary + '--\r\n').encode('ascii'))
        if len(data) > MAX_REQUEST_BYTES:
            raise ClientError('Multipart request exceeds 16 MiB.')
        return data, 'multipart/form-data; boundary=' + boundary
    return None, None


def call(base_url, method, path, token, query=(), body=None, content_type=None,
         timeout=15, max_bytes=DEFAULT_RESPONSE_BYTES):
    if not math.isfinite(timeout) or not 0 < timeout <= 120 or not 0 < max_bytes <= 64 * 1024 * 1024:
        raise ClientError('Timeout must be 0..120 seconds and response limit 1..67108864 bytes.')
    if method not in ('GET', 'POST', 'PUT', 'DELETE'):
        raise ClientError('Unsupported HTTP method.')
    if not token or '\r' in token or '\n' in token:
        raise ClientError('A nonempty single-line token is required.')
    if body is not None and (method == 'GET' or len(body) > MAX_REQUEST_BYTES):
        raise ClientError('GET cannot have a body; request limit is 16 MiB.')
    headers = {'X-Lemon-WebControl-Token': token, 'Accept': '*/*', 'Accept-Encoding': 'identity'}
    if content_type:
        headers['Content-Type'] = content_type
    request = urllib.request.Request(target_url(base_url, path, query), data=body,
                                     headers=headers, method=method)
    # Never inherit an HTTP proxy or follow a redirect with the phone credential.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        response = opener.open(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException):
        raise ClientError('Connection failed or timed out; check phone address, LAN reachability, and Listening state.') from None
    try:
        with response:
            declared = response.headers.get('Content-Length')
            if declared is not None:
                try:
                    declared = int(declared)
                except ValueError:
                    raise ClientError('Invalid response length; request outcome may be unknown.') from None
                if declared < 0:
                    raise ClientError('Invalid response length; request outcome may be unknown.')
                if declared > max_bytes:
                    raise ClientError('Response exceeds the byte limit; narrow the query or explicitly raise --max-response-bytes.')
            data = response.read(max_bytes + 1)
            if declared is not None and len(data) < declared:
                raise ClientError('Response was interrupted; request outcome may be unknown.')
            status = response.code
            mime = response.headers.get('Content-Type', '')
    except (TimeoutError, OSError, http.client.HTTPException):
        raise ClientError('Response read failed or timed out; request outcome may be unknown.') from None
    if len(data) > max_bytes:
        raise ClientError('Response exceeds the byte limit; narrow the query or explicitly raise --max-response-bytes.')
    result = {'http_status': status, 'content_type': mime}
    try:
        parsed = json.loads(data)
        result['body'] = parsed
    except (ValueError, UnicodeError):
        parsed = None
        try:
            decoded = data.decode('utf-8')
            if any(ord(c) < 32 and c not in '\n\r\t' for c in decoded):
                raise ValueError('Binary control characters')
            result['body_text'] = decoded
        except (UnicodeError, ValueError):
            result['body_base64'] = base64.b64encode(data).decode('ascii')
    ok = 200 <= status < 300 and not (isinstance(parsed, dict) and parsed.get('success') is False)
    result['ok'] = ok
    return result, data


def redact(value, token):
    if isinstance(value, str):
        return value.replace(token, '[REDACTED]')
    if isinstance(value, list):
        return [redact(item, token) for item in value]
    if isinstance(value, dict):
        return {redact(key, token): redact(item, token) for key, item in value.items()}
    return value


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('method', choices=('GET', 'POST', 'PUT', 'DELETE'))
    p.add_argument('path', help='/api/... path; use --query for parameters')
    p.add_argument('--base-url', default=os.environ.get('LEMON_BASE_URL'),
                   help='Exact phone origin, or LEMON_BASE_URL; no automatic discovery')
    p.add_argument('--query', action='append', default=[], metavar='KEY=VALUE')
    body = p.add_mutually_exclusive_group()
    body.add_argument('--json-file', help='Read JSON from a local file')
    body.add_argument('--upload-file', help='Upload one binary file as multipart field file')
    auth = p.add_mutually_exclusive_group()
    auth.add_argument('--prompt-token', action='store_true', help='User-operated terminal hidden input')
    auth.add_argument('--token-file', help='Read an existing protected user-selected file at runtime')
    p.add_argument('--output', help='Save successful raw response to a NEW file (0600); never overwrite')
    p.add_argument('--timeout', type=float, default=15, help='Socket I/O timeout in seconds, maximum 120')
    p.add_argument('--max-response-bytes', type=int, default=DEFAULT_RESPONSE_BYTES)
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if not args.base_url:
            raise ClientError('Set --base-url or LEMON_BASE_URL to the address shown on the phone.')
        if args.output and Path(args.output).exists():
            raise ClientError('--output must name a new file.')
        body, content_type = request_body(args)
        token = read_token(args)
        result, raw = call(args.base_url, args.method, args.path, token, args.query,
                           body, content_type, args.timeout, args.max_response_bytes)
        if args.output and result['ok']:
            # Binary downloads are lossless; these artifacts may contain private traffic.
            fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(raw)
            result = {k: v for k, v in result.items() if k not in ('body', 'body_text', 'body_base64')}
            result['saved_bytes'] = len(raw)
        print(json.dumps(redact(result, token), ensure_ascii=True, indent=2))
        return 0 if result['ok'] else 1
    except (ClientError, OSError, UnicodeError, ValueError):
        # Do not serialize arbitrary exception strings: they can contain URLs or file contents.
        error = sys.exc_info()[1]
        message = str(error) if isinstance(error, ClientError) else 'Local input/output failed; check file paths and permissions.'
        print(json.dumps({'ok': False, 'error': message}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
