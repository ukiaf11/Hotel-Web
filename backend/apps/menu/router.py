from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from apps.authentication.jwt_auth import current_hotel, distributor_auth, manager_auth
from apps.authentication.schemas import MessageOut

from .models import FoodItem, MenuCategory
from .schemas import CategoryIn, FoodItemIn, FoodItemOut, MenuOut

router = Router(tags=["menu"])

DEFAULT_CATEGORIES = ["Starters", "Main Course", "Breads", "Desserts", "Drinks"]


def _item_out(item: FoodItem) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": float(item.price),
        "category": item.category,
        "image": item.image,
        "is_available": item.is_available,
        "is_veg": item.is_veg,
        "is_custom_order": item.is_custom_order,
        "preparation_time_hours": item.preparation_time_hours,
    }


@router.get("/", response=MenuOut, auth=distributor_auth)
def menu(request):
    hotel = current_hotel(request)
    categories = list(hotel.categories.values_list("name", flat=True))
    if not categories:
        categories = DEFAULT_CATEGORIES
    return {
        "categories": categories,
        "items": [_item_out(item) for item in hotel.food_items.all()],
    }


@router.post("/categories/", response=MessageOut, auth=manager_auth)
def create_category(request, payload: CategoryIn):
    hotel = current_hotel(request)
    name = payload.name.strip()
    if not name:
        raise HttpError(400, "Category name cannot be empty.")
    if hotel.categories.filter(name__iexact=name).exists():
        raise HttpError(409, "That category already exists.")
    MenuCategory.objects.create(hotel=hotel, name=name, position=hotel.categories.count())
    return MessageOut(message=f"Category '{name}' created.")


@router.delete("/categories/{name}/", response=MessageOut, auth=manager_auth)
def delete_category(request, name: str):
    hotel = current_hotel(request)
    if hotel.food_items.filter(category__iexact=name).exists():
        raise HttpError(409, "Move or delete the items in this category first.")
    hotel.categories.filter(name__iexact=name).delete()
    return MessageOut(message="Category removed.")


@router.post("/items/", response=FoodItemOut, auth=manager_auth)
def create_item(request, payload: FoodItemIn):
    hotel = current_hotel(request)
    if payload.price <= 0:
        raise HttpError(400, "Price must be greater than zero.")
    item = FoodItem.objects.create(hotel=hotel, **payload.dict())
    MenuCategory.objects.get_or_create(
        hotel=hotel, name=item.category, defaults={"position": hotel.categories.count()}
    )
    return _item_out(item)


@router.put("/items/{item_id}/", response=FoodItemOut, auth=manager_auth)
def update_item(request, item_id: int, payload: FoodItemIn):
    item = get_object_or_404(FoodItem, pk=item_id, hotel=current_hotel(request))
    if payload.price <= 0:
        raise HttpError(400, "Price must be greater than zero.")
    for field, value in payload.dict().items():
        setattr(item, field, value)
    item.save()
    return _item_out(item)


@router.put("/items/{item_id}/toggle-stock/", response=FoodItemOut, auth=distributor_auth)
def toggle_stock(request, item_id: int):
    item = get_object_or_404(FoodItem, pk=item_id, hotel=current_hotel(request))
    item.is_available = not item.is_available
    item.save(update_fields=["is_available"])
    return _item_out(item)


@router.delete("/items/{item_id}/", response=MessageOut, auth=manager_auth)
def delete_item(request, item_id: int):
    item = get_object_or_404(FoodItem, pk=item_id, hotel=current_hotel(request))
    item.delete()
    return MessageOut(message="Menu item deleted.")
