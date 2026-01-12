# 🛡️ Standard Operating Procedures (SOP)

## 1. The "Clean Code" Protocol
- **Type Safety:** - Python: Use Type Hints for all function arguments and returns. (e.g., `def get_news(limit: int) -> list[Schema]:`)
    - TypeScript: No `any`. Define interfaces for all API responses.
- **Simplicity:** Prefer readability over cleverness. If a function is >50 lines, refactor it.
- **Comments:** Do not comment *what* code does. Comment *why* it does it.

## 2. Commit Strategy
- **Atomic Commits:** One feature/fix per commit.
- **Message Format:** `[Component] Action: Details`
    - Example: `[Backend] Feat: Add Article model and migration`
    - Example: `[Frontend] Fix: Resolve hydration error on Navbar`

## 3. Testing Standard
- **Backend:** Pytest. Every API endpoint must have a success test and a failure test.
- **Frontend:** Jest/React Testing Library for critical components.

## 4. Agent Instructions (Meta)
- When generating code, always cite the file path at the top.
- Do not remove existing code unless explicitly instructed to refactor.
- If a library is missing, ask for permission before adding it to `requirements.txt` or `package.json`.
