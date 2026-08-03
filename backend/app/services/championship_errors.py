"""Integrity errors shared by championship API consumers."""


class MissingCanonicalStandingsError(RuntimeError):
    """A completed season has not received its official standings snapshot."""
