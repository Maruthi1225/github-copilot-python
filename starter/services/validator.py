def find_incorrect_cells(board, solution, size):
    incorrect = []
    for row in range(size):
        for col in range(size):
            if board[row][col] != solution[row][col]:
                incorrect.append([row, col])
    return incorrect
