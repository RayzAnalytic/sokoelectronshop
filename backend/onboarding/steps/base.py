# apps/onboarding/steps/base.py

from abc import ABC, abstractmethod
from typing import Any


class BaseStep(ABC):
    key: str = ""
    optional: bool = False

    @abstractmethod
    def validate(self, session, payload: dict[str, Any]) -> None:
        """Raise django.core.exceptions.ValidationError on invalid payload."""

    @abstractmethod
    def apply(self, session, payload: dict[str, Any]) -> dict[str, Any]:
        """Persist. Must be idempotent. Returns the dict to store."""

    def summary(self, session) -> dict[str, Any]:
        """Read-only view used by GET /steps/<key>/ for prefill."""
        row = session.step_data.filter(step=self.key).first()
        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": row.data if row else {},
        }


class StepRegistry:
    _steps: dict[str, BaseStep] = {}

    @classmethod
    def register(cls, step: BaseStep) -> BaseStep:
        if not step.key:
            raise ValueError("Step must declare a key")
        cls._steps[step.key] = step
        return step

    @classmethod
    def get(cls, key: str) -> BaseStep:
        if key not in cls._steps:
            raise KeyError(f"Unknown onboarding step: {key}")
        return cls._steps[key]

    @classmethod
    def all(cls) -> list[BaseStep]:
        from ..constants import STEP_ORDER
        return [cls._steps[k] for k in STEP_ORDER if k in cls._steps]