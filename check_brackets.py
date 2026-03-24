import sys

def check_brackets(filename):
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()
    
    stack = []
    brackets = {"(": ")", "{": "}", "[": "]"}
    for i, char in enumerate(content):
        if char in brackets:
            stack.append((char, i))
        elif char in brackets.values():
            if not stack:
                print(f"Extra closing bracket '{char}' at position {i}")
                return
            top_char, top_pos = stack.pop()
            if brackets[top_char] != char:
                print(f"Mismatched bracket '{char}' at position {i}. Expected '{brackets[top_char]}' for '{top_char}' at position {top_pos}")
                return
    
    if stack:
        for char, pos in stack:
            print(f"Unclosed bracket '{char}' at position {pos}")
            # Find the line number
            line_num = content[:pos].count('\n') + 1
            print(f"Line number: {line_num}")
    else:
        print("All brackets are balanced!")

if __name__ == "__main__":
    check_brackets(sys.argv[1])
