from django.contrib import admin
from django.urls import path

from api.api import api
from api.feeds import DevelopingFeed, RecordFeed, WireFeed
from api.metrics import metrics_view
from api.stream import breaking_news_stream

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/stream", breaking_news_stream),

    # Prometheus scrape target. Access-controlled — see api/metrics.py.
    path("metrics", metrics_view, name="metrics"),

    # Outbound RSS, one feed per edition. `reporting.xml` is kept as an alias
    # for `record.xml` because it was the advertised path before the edition
    # was renamed.
    path("api/v1/feeds/wire.xml", WireFeed(), name="feed-wire"),
    path("api/v1/feeds/developing.xml", DevelopingFeed(), name="feed-developing"),
    path("api/v1/feeds/record.xml", RecordFeed(), name="feed-record"),
    path("api/v1/feeds/reporting.xml", RecordFeed(), name="feed-reporting-alias"),

    # V3: Versioned API endpoint
    path("api/v1/", api.urls),
]
