"""BaseRepository — generic CRUD foundation, mirrors JpaRepository<T, ID>."""

from typing import Generic, TypeVar, Type, Optional
from sqlalchemy.orm import Session

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """
    Generic base repository providing common save / delete / find_by_id.
    Domain repositories extend this and add query methods specific to their model.
    The Session is injected at construction time — one repository instance per request.
    """

    def __init__(self, model: Type[T], db: Session) -> None:
        self.model = model
        self.db = db

    def find_by_id(self, pk) -> Optional[T]:
        """Equivalent to JpaRepository.findById()."""
        return self.db.get(self.model, pk)

    def save(self, entity: T) -> T:
        """Stage the entity for INSERT/UPDATE — caller must commit."""
        self.db.add(entity)
        return entity

    def delete(self, entity: T) -> None:
        """Stage the entity for DELETE — caller must commit."""
        self.db.delete(entity)

    def flush(self) -> None:
        """Flush pending changes without committing."""
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, entity: T) -> T:
        self.db.refresh(entity)
        return entity
