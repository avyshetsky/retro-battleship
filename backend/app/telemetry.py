"""OpenTelemetry wiring for traces and metrics.

The backend exports OTLP over HTTP to a collector. Everything is driven by
standard ``OTEL_*`` environment variables so it slots into any observability
stack (Jaeger, Tempo, Honeycomb, Grafana Cloud, ...). If no collector endpoint
is configured the exporters simply have nowhere to send to — the app still runs
perfectly, which keeps local development and the public demo frictionless.

Key env vars:
- ``OTEL_EXPORTER_OTLP_ENDPOINT``  e.g. ``http://otel-collector:4318``
- ``OTEL_SERVICE_NAME``            defaults to ``battleship-api``
- ``OTEL_TRACES_EXPORTER=none``    disable trace export entirely
"""

from __future__ import annotations

import logging
import os

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger("battleship.telemetry")

_initialised = False


def _otlp_configured() -> bool:
    return bool(
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
        or os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
        or os.getenv("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT")
    )


def setup_telemetry() -> None:
    """Initialise global tracer and meter providers (idempotent)."""
    global _initialised
    if _initialised:
        return
    _initialised = True

    service_name = os.getenv("OTEL_SERVICE_NAME", "battleship-api")
    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": os.getenv("APP_VERSION", "0.1.0"),
            "service.instance.id": os.getenv("HOSTNAME", "local"),
        }
    )

    tracer_provider = TracerProvider(resource=resource)
    meter_provider_readers: list[PeriodicExportingMetricReader] = []

    if _otlp_configured():
        tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        meter_provider_readers.append(
            PeriodicExportingMetricReader(OTLPMetricExporter())
        )
        logger.info("OTLP exporters enabled (endpoint configured)")
    else:
        logger.info("No OTLP endpoint configured; telemetry runs in no-export mode")

    trace.set_tracer_provider(tracer_provider)
    metrics.set_meter_provider(
        MeterProvider(resource=resource, metric_readers=meter_provider_readers)
    )


def get_tracer(name: str = "battleship") -> trace.Tracer:
    return trace.get_tracer(name)


# --- Application metrics -----------------------------------------------------
# Created lazily so the meter provider is configured first.

_meter = None
_counters: dict[str, object] = {}
_histograms: dict[str, object] = {}


def _meter_instance():
    global _meter
    if _meter is None:
        _meter = metrics.get_meter("battleship.app")
    return _meter


def count(name: str, description: str, attributes: dict | None = None, value: int = 1) -> None:
    """Increment a named counter metric."""
    counter = _counters.get(name)
    if counter is None:
        counter = _meter_instance().create_counter(name, description=description)
        _counters[name] = counter
    counter.add(value, attributes or {})


def record(name: str, description: str, value: float, unit: str = "ms",
           attributes: dict | None = None) -> None:
    """Record a value into a named histogram metric."""
    hist = _histograms.get(name)
    if hist is None:
        hist = _meter_instance().create_histogram(name, description=description, unit=unit)
        _histograms[name] = hist
    hist.record(value, attributes or {})
