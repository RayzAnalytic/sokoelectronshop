"""
This app has no models.

Every entity it manages — Order, OrderItem, Payment, OrderStatusEvent —
lives in `checkout`. The admin module is a read/proxy layer that shapes
those models for the dashboard UI.

If a future feature needs admin-only state (a `Refund` row that tracks
partial refunds, a `ReturnRequest` that captures the returned goods),
add it here. Until then, this file exists only so Django treats the
module as an app.
"""