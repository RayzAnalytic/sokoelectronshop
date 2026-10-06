from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from authentication.models import User
from catalog.models import Category, Brand, Product
from . import services
from .models import ChatSession


def _fake_message(content="", tool_calls=None):
    return SimpleNamespace(content=content, tool_calls=tool_calls or [])


def _fake_completion(message):
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _tool_call(name, args_json):
    return SimpleNamespace(
        id=f"c-{name}",
        function=SimpleNamespace(name=name, arguments=args_json),
    )


class ChatEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anonymous_can_chat(self):
        with patch("ai.services.call_model") as mock:
            mock.return_value = _fake_completion(_fake_message(content="Hi!"))
            r = self.client.post("/api/ai/chat/", {"message": "hi"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("session_id", r.data)
        self.assertFalse(r.data["requires_auth"])

    def test_empty_message_rejected(self):
        r = self.client.post("/api/ai/chat/", {"message": ""}, format="json")
        self.assertEqual(r.status_code, 400)


class ProductSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cat = Category.objects.create(name="Laptops", icon_name="Laptop")
        brand = Brand.objects.create(name="HP")
        Product.objects.create(
            id="prod_hp1", name="HP Pavilion 15", brand=brand, category=cat,
            price="78500.00", stock_quantity=8, description="Reliable.",
        )

    def test_search_returns_card(self):
        with patch("ai.services.call_model") as mock:
            mock.side_effect = [
                _fake_completion(_fake_message(
                    tool_calls=[_tool_call("search_products", '{"query": "HP"}')],
                )),
                _fake_completion(_fake_message(content="Here's a laptop.")),
            ]
            r = self.client.post(
                "/api/ai/chat/", {"message": "show me HP"}, format="json",
            )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["products"]), 1)
        self.assertEqual(r.data["products"][0]["id"], "prod_hp1")


class OrderAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anon_order_query_requires_auth(self):
        with patch("ai.services.call_model") as mock:
            mock.side_effect = [
                _fake_completion(_fake_message(
                    tool_calls=[_tool_call("get_my_orders", "{}")],
                )),
                _fake_completion(_fake_message(content="Please sign in.")),
            ]
            r = self.client.post(
                "/api/ai/chat/", {"message": "my orders"}, format="json",
            )
        self.assertTrue(r.data["requires_auth"])


class PolicyTests(TestCase):
    def test_delivery_policy_present(self):
        result = services.execute_tool(
            "get_shop_policies", {"topic": "delivery"}, request=None,
        )
        self.assertIn("policy", result)

    def test_unknown_topic(self):
        result = services.execute_tool(
            "get_shop_policies", {"topic": "nonsense"}, request=None,
        )
        self.assertEqual(result["error"], "UNKNOWN_TOPIC")


class SessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_session_id_reused(self):
        with patch("ai.services.call_model") as mock:
            mock.return_value = _fake_completion(_fake_message(content="ok"))
            r1 = self.client.post("/api/ai/chat/", {"message": "hi"}, format="json")
            sid = r1.data["session_id"]
            r2 = self.client.post(
                "/api/ai/chat/",
                {"message": "again", "session_id": sid},
                format="json",
            )
        self.assertEqual(r2.data["session_id"], sid)