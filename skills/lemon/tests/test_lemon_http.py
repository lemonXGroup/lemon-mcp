"""Transport-level checks using loopback fixtures, never an iPhone."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

SPEC = importlib.util.spec_from_file_location('lemon_http', Path(__file__).parents[1] / 'scripts/lemon_http.py')
client = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(client)
TOKEN = 'fixture-auth-only'


class Handler(BaseHTTPRequestHandler):
    calls = []

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.handle_call()

    def do_POST(self):
        self.handle_call()

    def handle_call(self):
        data = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        self.calls.append((self.command, self.path, dict(self.headers), data))
        status = 200
        mime = 'application/json'
        body = b'{"success":true,"value":"ok"}'
        if self.path == '/api/interrupted':
            self.send_response(200)
            self.send_header('Content-Length', '100')
            self.end_headers()
            self.wfile.write(b'partial')
            self.close_connection = True
            return
        if self.path == '/api/redirect':
            self.send_response(302)
            self.send_header('Location', '/api/redirect-target')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if self.path == '/api/rejected':
            body = b'{"success":false,"err_msg":"fixture rejection"}'
        elif self.path == '/api/unauthorized':
            status = 401
            body = b'{"success":false,"reason":"caller_authentication_required"}'
        elif self.path == '/api/binary':
            mime = 'application/octet-stream'
            body = bytes(range(256))
        elif self.path == '/api/oversized':
            body = b'x' * 1025
        elif self.path == '/api/log':
            mime = 'text/plain'
            body = b'line one\nline two'
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        Handler.calls.clear()

    def request(self, path, **kwargs):
        return client.call(self.origin, kwargs.pop('method', 'GET'), path, TOKEN, **kwargs)

    def invoke(self, *args):
        stdout, stderr = io.StringIO(), io.StringIO()
        with mock.patch.dict(os.environ, {'LEMON_WEB_CONTROL_TOKEN': TOKEN, 'LEMON_BASE_URL': self.origin}), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = client.main(args)
        return code, stdout.getvalue(), stderr.getvalue()

    def test_auth_header_query_precision_and_no_proxy(self):
        with mock.patch.dict(os.environ, {'http_proxy': 'http://127.0.0.1:1', 'HTTP_PROXY': 'http://127.0.0.1:1', 'no_proxy': '', 'NO_PROXY': ''}):
            result, _ = self.request('/api/requests', query=['q=a b&中', 'id=18446744073709551615'])
        self.assertTrue(result['ok'])
        method, path, headers, _ = Handler.calls[0]
        self.assertEqual(headers['X-Lemon-Webcontrol-Token'], TOKEN)
        self.assertEqual(path, '/api/requests?q=a+b%26%E4%B8%AD&id=18446744073709551615')
        self.assertNotIn(TOKEN, path)
        self.assertEqual(method, 'GET')

    def test_post_json_file_preserves_payload_and_one_request(self):
        with tempfile.TemporaryDirectory() as temp:
            payload = Path(temp) / 'package.json'
            payload.write_text('{"name":"测试","id":18446744073709551615}', encoding='utf-8')
            code, output, _ = self.invoke('POST', '/api/rewrite/scripts/validate', '--json-file', str(payload))
            self.assertEqual(code, 0)
            self.assertTrue(json.loads(output)['ok'])
            self.assertEqual(Handler.calls[0][3], payload.read_bytes())
            self.assertEqual(Handler.calls[0][2]['Content-Type'], 'application/json')
            self.assertEqual(len(Handler.calls), 1)

    def test_redirect_does_not_make_second_credentialed_request(self):
        result, _ = self.request('/api/redirect')
        self.assertFalse(result['ok'])
        self.assertEqual(result['http_status'], 302)
        self.assertEqual(len(Handler.calls), 1)

    def test_http_and_application_failures_exit_nonzero(self):
        for path, status in [('/api/rejected', 200), ('/api/unauthorized', 401)]:
            with self.subTest(path=path):
                code, output, _ = self.invoke('GET', path)
                self.assertEqual(code, 1)
                self.assertEqual(json.loads(output)['http_status'], status)
                self.assertFalse(json.loads(output)['ok'])

    def test_binary_download_is_lossless_private_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'capture.bin'
            code, output, _ = self.invoke('GET', '/api/binary', '--output', str(target))
            self.assertEqual(code, 0)
            self.assertEqual(target.read_bytes(), bytes(range(256)))
            self.assertNotIn('body_base64', json.loads(output))
            if os.name == 'posix':
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            call_count = len(Handler.calls)
            code, _, _ = self.invoke('GET', '/api/binary', '--output', str(target))
            self.assertEqual(code, 2)
            self.assertEqual(len(Handler.calls), call_count)
            self.assertEqual(target.read_bytes(), bytes(range(256)))

    def test_binary_console_and_text_tail(self):
        result, _ = self.request('/api/binary')
        self.assertIn('body_base64', result)
        result, _ = self.request('/api/log')
        self.assertEqual(result['body_text'], 'line one\nline two')

    def test_oversized_response_not_silently_truncated_or_saved(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'too-big.bin'
            code, _, error = self.invoke('GET', '/api/oversized', '--max-response-bytes', '1024', '--output', str(target))
            self.assertEqual(code, 2)
            self.assertIn('exceeds', error)
            self.assertFalse(target.exists())

    def test_interrupted_mutation_is_unknown_and_not_retried(self):
        code, _, error = self.invoke('POST', '/api/interrupted')
        self.assertEqual(code, 2)
        self.assertIn('outcome may be unknown', error)
        self.assertEqual(len(Handler.calls), 1)

    def test_rejected_response_is_not_saved(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'failure.json'
            code, _, _ = self.invoke('GET', '/api/rejected', '--output', str(target))
            self.assertEqual(code, 1)
            self.assertFalse(target.exists())

    def test_multipart_upload_preserves_binary(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'fixture.bin'
            source.write_bytes(bytes(range(256)))
            code, _, _ = self.invoke('POST', '/api/files/upload', '--query', 'path=MockFiles', '--upload-file', str(source))
            self.assertEqual(code, 0)
            _, path, headers, body = Handler.calls[0]
            self.assertEqual(path, '/api/files/upload?path=MockFiles')
            self.assertIn('multipart/form-data; boundary=', headers['Content-Type'])
            self.assertIn(b'name="file"; filename="fixture.bin"', body)
            self.assertIn(bytes(range(256)), body)

    def test_malformed_input_rejected_before_network(self):
        for base, path, query in [
            ('https://user:pass@example.com', '/api/env', []),
            ('http://example.com/prefix', '/api/env', []),
            (self.origin, 'https://example.com/api/env', []),
            (self.origin, '/api/env?token=bad', []),
            (self.origin, '/api/env', ['token=bad']),
            (self.origin, '/api/env', ['bad-query']),
        ]:
            with self.subTest(base=base, path=path):
                with self.assertRaises(client.ClientError):
                    client.call(base, 'GET', path, TOKEN, query=query)
        self.assertFalse(Handler.calls)

    def test_credential_sources_and_no_echo(self):
        with tempfile.TemporaryDirectory() as temp:
            secret = Path(temp) / 'credential'
            secret.write_text('001234\n', encoding='utf-8')
            secret.chmod(0o600)
            args = client.parser().parse_args(['GET', '/api/env', '--token-file', str(secret)])
            self.assertEqual(client.read_token(args), '001234')
            if os.name == 'posix':
                secret.chmod(0o644)
                with self.assertRaises(client.ClientError):
                    client.read_token(args)
        args = client.parser().parse_args(['GET', '/api/env', '--prompt-token'])
        with mock.patch.object(client.sys.stdin, 'isatty', return_value=False), mock.patch.object(client.getpass, 'getpass') as prompt:
            with self.assertRaises(client.ClientError):
                client.read_token(args)
            prompt.assert_not_called()
        self.assertEqual(client.redact({'echo': TOKEN}, TOKEN), {'echo': '[REDACTED]'})

    def test_missing_credential_never_sends_request(self):
        with mock.patch.dict(os.environ, {'LEMON_WEB_CONTROL_TOKEN': '', 'LEMON_BASE_URL': self.origin}):
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(client.main(['GET', '/api/env']), 2)
        self.assertFalse(Handler.calls)


if __name__ == '__main__':
    unittest.main()
