from ninja import Schema


class FoodItemOut(Schema):
    id: int
    name: str
    description: str
    price: float
    category: str
    image: str
    is_available: bool
    is_veg: bool
    is_custom_order: bool
    preparation_time_hours: float


class FoodItemIn(Schema):
    name: str
    description: str = ""
    price: float
    category: str = "Mains"
    image: str = ""
    is_available: bool = True
    is_veg: bool = True
    is_custom_order: bool = False
    preparation_time_hours: float = 0


class MenuOut(Schema):
    categories: list[str]
    items: list[FoodItemOut]


class CategoryIn(Schema):
    name: str
