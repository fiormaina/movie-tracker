from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.folder import Folder
from app.models.user import User
from app.models.watch_item import WatchItem
from app.schemas.library import (
    CreateWatchItemRequest,
    FolderResponse,
    UpdateWatchItemRequest,
    WatchHistoryItemResponse,
    WatchItemDetailResponse,
    WatchItemsListResponse,
)

STATUS_PLANNED = "planned"
STATUS_WATCHING = "watching"
STATUS_COMPLETED = "completed"

SYSTEM_CONTINUE_WATCHING = "continue_watching"
SYSTEM_WATCHED = "watched"
SYSTEM_WILL_WATCH = "will_watch"

SYSTEM_FOLDER_DEFINITIONS = (
    {
        "system_key": SYSTEM_CONTINUE_WATCHING,
        "status": STATUS_WATCHING,
        "title": "Продолжить просмотр",
        "description": "Фильмы и сериалы, которые пользователь смотрит сейчас",
    },
    {
        "system_key": SYSTEM_WATCHED,
        "status": STATUS_COMPLETED,
        "title": "Просмотрено",
        "description": "Контент, который пользователь уже посмотрел",
    },
    {
        "system_key": SYSTEM_WILL_WATCH,
        "status": STATUS_PLANNED,
        "title": "Буду смотреть",
        "description": "Контент, который пользователь отложил на будущее",
    },
)

STATUS_TO_SYSTEM_KEY = {
    STATUS_PLANNED: SYSTEM_WILL_WATCH,
    STATUS_WATCHING: SYSTEM_CONTINUE_WATCHING,
    STATUS_COMPLETED: SYSTEM_WATCHED,
}

SYSTEM_FOLDER_ORDER = {
    SYSTEM_CONTINUE_WATCHING: 0,
    SYSTEM_WATCHED: 1,
    SYSTEM_WILL_WATCH: 2,
}


def ensure_default_folders(db: Session, user: User) -> dict[str, Folder]:
    statement = select(Folder).where(Folder.user_id == user.id)
    folders = list(db.scalars(statement))
    folders_by_system_key = {
        folder.system_key: folder
        for folder in folders
        if folder.is_system and folder.system_key is not None
    }

    created = False
    for definition in SYSTEM_FOLDER_DEFINITIONS:
        if definition["system_key"] in folders_by_system_key:
            continue

        folder = Folder(
            user_id=user.id,
            title=definition["title"],
            description=definition["description"],
            access="private",
            is_system=True,
            system_key=definition["system_key"],
        )
        db.add(folder)
        folders.append(folder)
        folders_by_system_key[definition["system_key"]] = folder
        created = True

    if created:
        db.flush()

    return folders_by_system_key


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _infer_status(payload: CreateWatchItemRequest) -> str:
    if payload.status is not None:
        return payload.status

    if payload.watched_at is not None:
        return STATUS_COMPLETED

    if payload.progress_percent == 100:
        return STATUS_COMPLETED

    if payload.duration_seconds and payload.progress_seconds is not None and payload.progress_seconds >= payload.duration_seconds:
        return STATUS_COMPLETED

    if (payload.progress_percent or 0) > 0 or payload.progress_seconds is not None:
        return STATUS_WATCHING

    return STATUS_PLANNED


def _resolve_progress_percent(
    status_value: str,
    progress_percent: int | None,
    progress_seconds: int | None,
    duration_seconds: int | None,
) -> int:
    if status_value == STATUS_COMPLETED:
        return 100

    if progress_percent is not None:
        return progress_percent

    if progress_seconds is not None and duration_seconds:
        return max(0, min(100, round(progress_seconds / duration_seconds * 100)))

    return 0


def _build_badge(item: WatchItem) -> str | None:
    if item.content_type != "series":
        return None

    if item.season is not None and item.episode is not None:
        return f"Сезон {item.season}, серия {item.episode}"

    if item.season is not None:
        return f"Сезон {item.season}"

    if item.episode is not None:
        return f"Серия {item.episode}"

    return None


def _build_meta(item: WatchItem) -> str | None:
    parts: list[str] = []
    if item.genres:
        parts.append(", ".join(item.genres))
    if item.year is not None:
        parts.append(str(item.year))
    if item.duration_text:
        parts.append(item.duration_text)
    return " · ".join(parts) or None


def _format_imdb_rating(imdb_rating: float | None) -> str:
    if imdb_rating is None:
        return "—"
    return f"{imdb_rating:.1f}".rstrip("0").rstrip(".")


def _get_custom_folder_or_404(db: Session, user: User, folder_id: int) -> Folder:
    statement = select(Folder).where(
        Folder.id == folder_id,
        Folder.user_id == user.id,
    )
    folder = db.scalar(statement)
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Папка не найдена"},
        )
    if folder.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Системную папку нельзя выбирать как пользовательскую"},
        )
    return folder


def _get_watch_item_or_404(db: Session, user: User, item_id: int) -> WatchItem:
    statement = (
        select(WatchItem)
        .where(WatchItem.id == item_id, WatchItem.user_id == user.id)
        .options(
            selectinload(WatchItem.system_folder),
            selectinload(WatchItem.custom_folder),
        )
    )
    item = db.scalar(statement)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Контент не найден"},
        )
    return item


def _to_folder_response(folder: Folder, items_count: int) -> FolderResponse:
    return FolderResponse(
        id=folder.id,
        title=folder.title,
        description=folder.description,
        access=folder.access,
        is_system=folder.is_system,
        system_key=folder.system_key,
        can_delete=folder.can_delete,
        items_count=items_count,
    )


def _to_history_item_response(item: WatchItem) -> WatchHistoryItemResponse:
    return WatchHistoryItemResponse(
        id=item.id,
        title=item.title,
        content_type=item.content_type,
        status=item.status,
        progress_percent=item.progress_percent,
        progress_seconds=item.progress_seconds,
        duration_seconds=item.duration_seconds,
        rating=item.user_rating,
        comment=item.comment,
        custom_folder_id=item.custom_folder_id,
        system_folder_id=item.system_folder_id,
        badge=_build_badge(item),
        meta=_build_meta(item),
        year=item.year,
        genres=item.genres or [],
        duration_text=item.duration_text,
        source=item.source,
        updated_at=item.updated_at,
        watched_at=item.watched_at,
    )


def _to_detail_response(item: WatchItem) -> WatchItemDetailResponse:
    return WatchItemDetailResponse(
        id=item.id,
        title=item.title,
        genres=item.genres or [],
        year=item.year,
        duration_text=item.duration_text,
        content_type=item.content_type,
        imdb_rating=_format_imdb_rating(item.imdb_rating),
        user_rating=item.user_rating,
        progress_percent=item.progress_percent,
        progress_seconds=item.progress_seconds,
        duration_seconds=item.duration_seconds,
        custom_folder_id=item.custom_folder_id,
        system_folder_id=item.system_folder_id,
        watched=item.status == STATUS_COMPLETED,
        comment=item.comment,
        description=item.description,
        status=item.status,
        season=item.season,
        episode=item.episode,
        source=item.source,
        watched_at=item.watched_at,
        updated_at=item.updated_at,
    )


def list_folders(db: Session, user: User) -> list[FolderResponse]:
    ensure_default_folders(db, user)

    folders = list(
        db.scalars(
            select(Folder)
            .where(Folder.user_id == user.id)
            .order_by(Folder.is_system.desc(), Folder.title.asc()),
        )
    )

    system_counts = dict(
        db.execute(
            select(WatchItem.system_folder_id, func.count(WatchItem.id))
            .where(WatchItem.user_id == user.id)
            .group_by(WatchItem.system_folder_id)
        ).all()
    )
    custom_counts = dict(
        db.execute(
            select(WatchItem.custom_folder_id, func.count(WatchItem.id))
            .where(
                WatchItem.user_id == user.id,
                WatchItem.custom_folder_id.is_not(None),
            )
            .group_by(WatchItem.custom_folder_id)
        ).all()
    )

    folders.sort(
        key=lambda folder: (
            0 if folder.is_system else 1,
            SYSTEM_FOLDER_ORDER.get(folder.system_key or "", 999),
            folder.title.lower(),
        )
    )

    return [
        _to_folder_response(
            folder=folder,
            items_count=system_counts.get(folder.id, 0)
            if folder.is_system
            else custom_counts.get(folder.id, 0),
        )
        for folder in folders
    ]


def list_watch_items(
    db: Session,
    user: User,
    content_type: str | None = None,
) -> WatchItemsListResponse:
    ensure_default_folders(db, user)

    statement = (
        select(WatchItem)
        .where(WatchItem.user_id == user.id)
        .options(
            selectinload(WatchItem.system_folder),
            selectinload(WatchItem.custom_folder),
        )
        .order_by(WatchItem.updated_at.desc(), WatchItem.id.desc())
    )
    if content_type is not None:
        statement = statement.where(WatchItem.content_type == content_type)

    items = list(db.scalars(statement))
    return WatchItemsListResponse(
        items=[_to_history_item_response(item) for item in items],
        watching_count=sum(1 for item in items if item.status == STATUS_WATCHING),
        completed_count=sum(1 for item in items if item.status == STATUS_COMPLETED),
        planned_count=sum(1 for item in items if item.status == STATUS_PLANNED),
    )


def get_watch_item_detail(db: Session, user: User, item_id: int) -> WatchItemDetailResponse:
    ensure_default_folders(db, user)
    item = _get_watch_item_or_404(db, user, item_id)
    return _to_detail_response(item)


def create_watch_item(
    db: Session,
    user: User,
    payload: CreateWatchItemRequest,
) -> WatchItemDetailResponse:
    folders_by_key = ensure_default_folders(db, user)
    resolved_status = _infer_status(payload)
    system_folder = folders_by_key[STATUS_TO_SYSTEM_KEY[resolved_status]]

    custom_folder_id = None
    if payload.custom_folder_id is not None:
        custom_folder_id = _get_custom_folder_or_404(db, user, payload.custom_folder_id).id

    progress_percent = _resolve_progress_percent(
        status_value=resolved_status,
        progress_percent=payload.progress_percent,
        progress_seconds=payload.progress_seconds,
        duration_seconds=payload.duration_seconds,
    )
    watched_at = payload.watched_at
    if resolved_status == STATUS_COMPLETED and watched_at is None:
        watched_at = _now()

    progress_seconds = payload.progress_seconds
    if resolved_status == STATUS_COMPLETED and progress_seconds is None and payload.duration_seconds is not None:
        progress_seconds = payload.duration_seconds

    item = WatchItem(
        user_id=user.id,
        system_folder_id=system_folder.id,
        custom_folder_id=custom_folder_id,
        source=payload.source,
        content_type=payload.content_type,
        title=payload.title,
        year=payload.year,
        genres=payload.genres,
        duration_text=payload.duration_text,
        description=payload.description,
        imdb_rating=None,
        user_rating=payload.rating,
        comment=payload.comment,
        status=resolved_status,
        progress_percent=progress_percent,
        progress_seconds=progress_seconds,
        duration_seconds=payload.duration_seconds,
        season=payload.season if payload.content_type == "series" else None,
        episode=payload.episode if payload.content_type == "series" else None,
        watched_at=watched_at,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_detail_response(item)


def update_watch_item(
    db: Session,
    user: User,
    item_id: int,
    payload: UpdateWatchItemRequest,
) -> WatchItemDetailResponse:
    folders_by_key = ensure_default_folders(db, user)
    item = _get_watch_item_or_404(db, user, item_id)
    updates = payload.model_dump(exclude_unset=True, by_alias=False)

    if "status" in updates and payload.status is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Статус не может быть пустым"},
        )

    if "title" in updates:
        item.title = payload.title
    if "year" in updates:
        item.year = payload.year
    if "genres" in updates and payload.genres is not None:
        item.genres = payload.genres
    if "duration_text" in updates:
        item.duration_text = payload.duration_text
    if "description" in updates:
        item.description = payload.description
    if "rating" in updates:
        item.user_rating = payload.rating
    if "comment" in updates:
        item.comment = payload.comment
    if "duration_seconds" in updates:
        item.duration_seconds = payload.duration_seconds
    if "progress_seconds" in updates:
        item.progress_seconds = payload.progress_seconds

    if "custom_folder_id" in updates:
        if payload.custom_folder_id is None:
            item.custom_folder_id = None
        else:
            item.custom_folder_id = _get_custom_folder_or_404(db, user, payload.custom_folder_id).id

    if item.content_type != "series" and ("season" in updates or "episode" in updates):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Сезон и серия доступны только для сериалов"},
        )

    if "season" in updates and item.content_type == "series":
        item.season = payload.season
    if "episode" in updates and item.content_type == "series":
        item.episode = payload.episode

    next_status = payload.status if "status" in updates else item.status
    if "progress_percent" in updates or "progress_seconds" in updates or "duration_seconds" in updates or "status" in updates:
        item.progress_percent = _resolve_progress_percent(
            status_value=next_status,
            progress_percent=payload.progress_percent if "progress_percent" in updates else item.progress_percent,
            progress_seconds=item.progress_seconds,
            duration_seconds=item.duration_seconds,
        )

    if "status" in updates:
        item.status = payload.status
        item.system_folder_id = folders_by_key[STATUS_TO_SYSTEM_KEY[payload.status]].id

    if item.status == STATUS_COMPLETED:
        item.progress_percent = 100
        if "watched_at" in updates:
            item.watched_at = payload.watched_at or item.watched_at or _now()
        elif item.watched_at is None:
            item.watched_at = _now()
        if item.progress_seconds is None and item.duration_seconds is not None:
            item.progress_seconds = item.duration_seconds
    elif "watched_at" in updates:
        item.watched_at = payload.watched_at
    elif "status" in updates:
        item.watched_at = None

    db.commit()
    db.refresh(item)
    return _to_detail_response(item)


def delete_folder(db: Session, user: User, folder_id: int) -> None:
    ensure_default_folders(db, user)
    statement = select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
    folder = db.scalar(statement)
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Папка не найдена"},
        )
    if folder.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Системные папки удалять нельзя"},
        )

    db.delete(folder)
    db.commit()
