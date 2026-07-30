from flask import Blueprint, jsonify, render_template, request

from services.generator import generate_puzzle
from services.validator import find_incorrect_cells
from services.solver import SIZE


game_bp = Blueprint("game", __name__)

CURRENT = {
    "puzzle": None,
    "solution": None,
    "completion_time": None,
}


@game_bp.route("/")
def index():
    return render_template("index.html")


@game_bp.route("/new")
def new_game():
    clues = int(request.args.get("clues", 35))
    puzzle, solution = generate_puzzle(clues)
    CURRENT["puzzle"] = puzzle
    CURRENT["solution"] = solution
    CURRENT["completion_time"] = None
    return jsonify({"puzzle": puzzle})


@game_bp.route("/complete", methods=["POST"])
def complete_game():
    data = request.json or {}
    completion_time = data.get("completion_time")
    CURRENT["completion_time"] = completion_time
    return jsonify({"completion_time": completion_time})


def find_first_empty_cell(board):
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] == 0:
                return row, col
    return None


@game_bp.route("/hint", methods=["POST"])
def hint_cell():
    puzzle = CURRENT.get("puzzle")
    solution = CURRENT.get("solution")
    if puzzle is None or solution is None:
        return jsonify({"error": "No game in progress"}), 400

    empty_cell = find_first_empty_cell(puzzle)
    if empty_cell is None:
        return jsonify({"error": "No empty cells left"}), 400

    row, col = empty_cell
    value = solution[row][col]
    CURRENT["puzzle"][row][col] = value
    return jsonify({"row": row, "col": col, "value": value})


@game_bp.route("/check", methods=["POST"])
def check_solution():
    data = request.json or {}
    board = data.get("board")
    solution = CURRENT.get("solution")
    if solution is None:
        return jsonify({"error": "No game in progress"}), 400
    incorrect = find_incorrect_cells(board, solution, SIZE)
    if not incorrect and data.get("completion_time") is not None:
        CURRENT["completion_time"] = data.get("completion_time")
    response = {"incorrect": incorrect}
    if CURRENT["completion_time"] is not None:
        response["completion_time"] = CURRENT["completion_time"]
    return jsonify(response)
