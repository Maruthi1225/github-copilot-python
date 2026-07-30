import app
from routes.game import CURRENT
from services.generator import generate_puzzle
from services.solver import EMPTY, SIZE, count_solutions


def _board_with_value(value):
    return [[value for _ in range(9)] for _ in range(9)]


def test_index_route_returns_homepage(client):
    response = client.get("/")

    assert response.status_code == 200
    assert b"Sudoku Game" in response.data


def test_new_game_returns_puzzle_and_updates_state(client, monkeypatch):
    puzzle = _board_with_value(0)
    solution = _board_with_value(1)

    monkeypatch.setattr("routes.game.generate_puzzle", lambda clues: (puzzle, solution))

    response = client.get("/new?clues=42")

    assert response.status_code == 200
    assert response.get_json() == {"puzzle": puzzle}
    assert CURRENT["puzzle"] == puzzle
    assert CURRENT["solution"] == solution


def test_new_game_uses_requested_clues(client, monkeypatch):
    captured = {}

    def fake_generate_puzzle(clues):
        captured["clues"] = clues
        return _board_with_value(0), _board_with_value(1)

    monkeypatch.setattr("routes.game.generate_puzzle", fake_generate_puzzle)

    response = client.get("/new?clues=24")

    assert response.status_code == 200
    assert captured["clues"] == 24


def test_check_solution_returns_error_when_no_game_is_active(client):
    response = client.post("/check", json={"board": _board_with_value(1)})

    assert response.status_code == 400
    assert response.get_json() == {"error": "No game in progress"}


def test_check_solution_reports_incorrect_cells(client, monkeypatch):
    solution = [[row * 9 + col + 1 for col in range(9)] for row in range(9)]
    puzzle = _board_with_value(0)

    monkeypatch.setattr("routes.game.generate_puzzle", lambda clues: (puzzle, solution))
    client.get("/new")

    board = [row[:] for row in solution]
    board[0][0] = 9
    board[4][7] = 3

    response = client.post("/check", json={"board": board})

    assert response.status_code == 200
    assert response.get_json() == {"incorrect": [[0, 0], [4, 7]]}


def test_check_solution_stores_completion_time_when_solved(client, monkeypatch):
    solution = [[row * 9 + col + 1 for col in range(9)] for row in range(9)]
    puzzle = _board_with_value(0)

    monkeypatch.setattr("routes.game.generate_puzzle", lambda clues: (puzzle, solution))
    client.get("/new")

    response = client.post("/check", json={"board": solution, "completion_time": "03:48"})

    assert response.status_code == 200
    assert response.get_json() == {"incorrect": [], "completion_time": "03:48"}
    assert CURRENT["completion_time"] == "03:48"


def test_complete_route_stores_completion_time(client):
    response = client.post("/complete", json={"completion_time": "00:15"})

    assert response.status_code == 200
    assert response.get_json() == {"completion_time": "00:15"}
    assert CURRENT["completion_time"] == "00:15"


def test_hint_route_returns_one_empty_cell_and_locks_it(client, monkeypatch):
    puzzle = [row[:] for row in _board_with_value(0)]
    solution = [[row * 9 + col + 1 for col in range(9)] for row in range(9)]

    monkeypatch.setattr("routes.game.generate_puzzle", lambda clues: (puzzle, solution))
    client.get("/new")

    response = client.post("/hint")

    assert response.status_code == 200
    data = response.get_json()
    assert data["value"] == solution[data["row"]][data["col"]]
    assert CURRENT["puzzle"][data["row"]][data["col"]] == data["value"]
    assert sum(cell != 0 for row in CURRENT["puzzle"] for cell in row) == 1


def test_hint_route_returns_error_when_game_is_missing(client):
    response = client.post("/hint")

    assert response.status_code == 400
    assert response.get_json() == {"error": "No game in progress"}


def test_generated_puzzle_has_exactly_one_solution():
    puzzle, solution = generate_puzzle()

    assert count_solutions([row[:] for row in puzzle], limit=2) == 1
    assert any(cell == EMPTY for row in puzzle for cell in row)
    assert len(puzzle) == SIZE
    assert len(solution) == SIZE