"""
Shared pytest fixtures.

The autouse fixture below exists because of two real incidents, not as a
precaution. Both times a test mocked one vendor's SDK, the code underneath was
changed to reach the network by a different route, and the mock silently stopped
intercepting anything — so the suite quietly made live API calls against a real
key. Nothing failed, so nothing surfaced it; it was found by reading logs.

A test that needs HTTP should mock the client it actually uses. A test that
reaches a real host is a defect, so make it loud.
"""
import socket

import pytest

# Loopback is allowed: the Django test client, the live database and any local
# service are legitimate. Only genuinely outbound connections are blocked.
_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", "db", "redis", "postgres"}


@pytest.fixture(autouse=True)
def no_outbound_network(request, monkeypatch):
    """
    Fail any test that opens a socket to a non-local host.

    Opt out for a test that deliberately talks to the internet:

        @pytest.mark.allow_network
    """
    if request.node.get_closest_marker("allow_network"):
        return

    real_create_connection = socket.create_connection

    def guarded(address, *args, **kwargs):
        host = address[0] if isinstance(address, tuple) else address
        if str(host) not in _ALLOWED_HOSTS:
            raise RuntimeError(
                f"Test attempted a real network connection to {host!r}. "
                "Mock the client this code path uses, or mark the test with "
                "@pytest.mark.allow_network if the call is intended."
            )
        return real_create_connection(address, *args, **kwargs)

    monkeypatch.setattr(socket, "create_connection", guarded)


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "allow_network: test may open outbound network connections"
    )
