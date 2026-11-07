"""Temporal model extension points. Not selected automatically on small samples."""

from abc import ABC, abstractmethod
from typing import Any


class SequenceModel(ABC):
    name: str

    @abstractmethod
    def fit(self, sequences: Any, targets: Any) -> None:
        raise NotImplementedError

    @abstractmethod
    def predict(self, sequences: Any) -> Any:
        raise NotImplementedError


class LSTMPlaceholder(SequenceModel):
    name = "lstm"

    def fit(self, sequences: Any, targets: Any) -> None:
        raise NotImplementedError("LSTM training is disabled until the consented sample is large enough.")

    def predict(self, sequences: Any) -> Any:
        raise NotImplementedError("LSTM inference is not available in this deployment.")


class GRUPlaceholder(SequenceModel):
    name = "gru"

    def fit(self, sequences: Any, targets: Any) -> None:
        raise NotImplementedError("GRU training is disabled until the consented sample is large enough.")

    def predict(self, sequences: Any) -> Any:
        raise NotImplementedError("GRU inference is not available in this deployment.")


class TransformerPlaceholder(SequenceModel):
    name = "transformer"

    def fit(self, sequences: Any, targets: Any) -> None:
        raise NotImplementedError("Transformer training is disabled until the consented sample is large enough.")

    def predict(self, sequences: Any) -> Any:
        raise NotImplementedError("Transformer inference is not available in this deployment.")


TEMPORAL_MODELS = {
    "lstm": LSTMPlaceholder,
    "gru": GRUPlaceholder,
    "transformer": TransformerPlaceholder,
}
