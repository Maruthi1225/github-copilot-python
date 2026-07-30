import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def reset_current_state():
    from routes.game import CURRENT

    CURRENT["puzzle"] = None
    CURRENT["solution"] = None
    yield
    CURRENT["puzzle"] = None
    CURRENT["solution"] = None


@pytest.fixture()
def client():
    import app

    app.app.config["TESTING"] = True
    with app.app.test_client() as test_client:
        yield test_client