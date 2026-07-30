import random

from services.solver import SIZE, count_solutions, create_empty_board, deep_copy, fill_board


def generate_complete_board():
    board = create_empty_board()
    fill_board(board)
    return board


def has_unique_solution(board):
    return count_solutions(deep_copy(board), limit=2) == 1


def remove_single_cell(board, row, col):
    removed_value = board[row][col]
    board[row][col] = 0

    if has_unique_solution(board):
        return True

    board[row][col] = removed_value
    return False


def remove_cells_one_at_a_time(board, clues):
    cells_to_remove = SIZE * SIZE - clues
    positions = [(row, col) for row in range(SIZE) for col in range(SIZE)]
    random.shuffle(positions)

    for row, col in positions:
        if cells_to_remove <= 0:
            break
        if board[row][col] == 0:
            continue

        if remove_single_cell(board, row, col):
            cells_to_remove -= 1
        else:
            break

    return cells_to_remove == 0


def generate_puzzle(clues=35):
    while True:
        board = generate_complete_board()
        solution = deep_copy(board)
        if remove_cells_one_at_a_time(board, clues):
            puzzle = deep_copy(board)
            return puzzle, solution
