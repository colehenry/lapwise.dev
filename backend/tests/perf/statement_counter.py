"""Test-only SQL statement counting for hot read paths.

Counts every statement the shared async engine executes inside the context so
query-count budgets fail when N+1 behavior returns.
"""

from contextlib import contextmanager

from sqlalchemy import event

from app.database import engine


class StatementCounter:
    """Records SQL text for every statement executed while active."""

    def __init__(self) -> None:
        self.statements: list[str] = []

    @property
    def count(self) -> int:
        return len(self.statements)

    def matching(self, fragment: str) -> list[str]:
        lowered = fragment.lower()
        return [sql for sql in self.statements if lowered in sql.lower()]

    def report(self) -> str:
        lines = [f"{len(self.statements)} statement(s):"]
        for index, sql in enumerate(self.statements, 1):
            lines.append(f"  {index:>2}. {' '.join(sql.split())[:160]}")
        return "\n".join(lines)


@contextmanager
def count_statements():
    """Yields a StatementCounter covering the shared engine."""
    counter = StatementCounter()
    target = engine.sync_engine

    def before_cursor_execute(conn, cursor, statement, parameters, context, many):
        counter.statements.append(statement)

    event.listen(target, "before_cursor_execute", before_cursor_execute)
    try:
        yield counter
    finally:
        event.remove(target, "before_cursor_execute", before_cursor_execute)
