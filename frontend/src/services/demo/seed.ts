/**
 * Seed dataset for the in-browser demo backend.
 * Mirrors `backend/apps/console/management/commands/seed_demo.py` so the SPA behaves
 * identically whether it talks to Django or to the demo layer.
 */

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

export interface SeedMenuItem {
  name: string
  description: string
  price: number
  category: string
  custom: boolean
  veg: boolean
  prep: number
  image: string
}

export interface SeedHotel {
  email: string
  owner: string
  name: string
  place: string
  cuisine: string
  phone: string
  banner: string
  lat: number
  lng: number
  delivery: boolean
  fee: number
  minOrder: number
  radius: number
  avgMinutes: number
  open: string
  close: string
  rating: number
  ratingCount: number
  verified: boolean
  menu: SeedMenuItem[]
}

const item = (
  name: string,
  description: string,
  price: number,
  category: string,
  image: string,
  opts: Partial<Pick<SeedMenuItem, 'custom' | 'veg' | 'prep'>> = {},
): SeedMenuItem => ({
  name,
  description,
  price,
  category,
  image: img(image, 600),
  custom: opts.custom ?? false,
  veg: opts.veg ?? true,
  prep: opts.prep ?? 0,
})

export const SEED_HOTELS: SeedHotel[] = [
  {
    email: 'royal@hotelexpress.dev',
    owner: 'Aarav Menon',
    name: 'Royal Palace Kitchen',
    place: '12 Marine Drive, Downtown',
    cuisine: 'North Indian • Mughlai',
    phone: '+919812340001',
    banner: img('1517248135467-4c7edcad34c4'),
    lat: 19.076,
    lng: 72.8777,
    delivery: true,
    fee: 2.5,
    minOrder: 12,
    radius: 12,
    avgMinutes: 28,
    open: '09:00',
    close: '23:00',
    rating: 4.7,
    ratingCount: 218,
    verified: true,
    menu: [
      item('Spicy Paneer Tikka', 'Cottage cheese cubes marinated in yoghurt and tandoori spice.', 12.5, 'Starters', '1567188040759-fb8a883dc6d8', { custom: true, prep: 1 }),
      item('Tandoori Chicken Half', 'Charcoal-grilled, 24-hour marinated chicken.', 14, 'Starters', '1610057099443-fde8c4d50f91', { veg: false }),
      item('Butter Chicken', 'Slow-simmered tomato and cashew gravy.', 16.5, 'Main Course', '1588166524941-3bf61a9c41db', { veg: false }),
      item('Dal Makhani', 'Black lentils finished with cream overnight.', 11, 'Main Course', '1546833999-b9f581a1996d'),
      item('Garlic Naan', 'Tandoor bread brushed with garlic butter.', 3.5, 'Breads', '1601050690597-df0568f70950'),
      item('Royal Biryani Platter', 'Whole-pot dum biryani for four, made to order.', 42, 'Main Course', '1563379091339-03b21ab4a4f8', { custom: true, veg: false, prep: 3 }),
      item('Gulab Jamun', 'Warm milk dumplings in cardamom syrup.', 5, 'Desserts', '1666190092159-3171cf0fbb12'),
      item('Masala Chai', 'Brewed with fresh ginger and lemongrass.', 2.5, 'Drinks', '1571934811356-5cc061b6821f'),
    ],
  },
  {
    email: 'greenvalley@hotelexpress.dev',
    owner: 'Nisha Kapoor',
    name: 'Green Valley Dine',
    place: '88 West Side Avenue',
    cuisine: 'Vegan • Health bowls',
    phone: '+919812340002',
    banner: img('1467003909585-2f8a72700288'),
    lat: 19.1136,
    lng: 72.8697,
    delivery: true,
    fee: 0,
    minOrder: 18,
    radius: 8,
    avgMinutes: 25,
    open: '08:00',
    close: '21:00',
    rating: 4.5,
    ratingCount: 143,
    verified: true,
    menu: [
      item('Buddha Power Bowl', 'Quinoa, roasted chickpeas, avocado and tahini.', 13, 'Bowls', '1512621776951-a57141f2eefd'),
      item('Avocado Sourdough', 'Smashed avocado, chilli flakes, micro greens.', 9.5, 'Breakfast', '1541519227354-08fa5d50c44d'),
      item('Cold Pressed Greens', 'Kale, cucumber, green apple and ginger.', 6, 'Drinks', '1610970881699-44a5587cabec'),
      item('Vegan Lasagna Tray', 'Cashew béchamel, roasted vegetables — baked fresh.', 28, 'Main Course', '1574894709920-11b28e7367e3', { custom: true, prep: 2 }),
      item('Berry Chia Parfait', 'Overnight chia, coconut yoghurt, seasonal berries.', 7, 'Desserts', '1488477181946-6428a0291777'),
      item('Roasted Pumpkin Soup', 'Coconut cream and toasted seeds.', 8, 'Starters', '1547592166-23ac45744acd'),
    ],
  },
  {
    email: 'ocean@hotelexpress.dev',
    owner: 'Rahul Dsouza',
    name: 'Ocean Breeze Inn',
    place: 'Coastal Road, Lighthouse Point',
    cuisine: 'Seafood • Coastal',
    phone: '+919812340003',
    banner: img('1514933651103-005eec06c04b'),
    lat: 18.922,
    lng: 72.8347,
    delivery: false,
    fee: 0,
    minOrder: 0,
    radius: 5,
    avgMinutes: 40,
    open: '11:00',
    close: '23:30',
    rating: 4.8,
    ratingCount: 302,
    verified: true,
    menu: [
      item('Garlic Butter Prawns', 'Tiger prawns seared in garlic butter.', 18, 'Starters', '1559737558-2f5a35f4523b', { veg: false }),
      item('Grilled Catch of the Day', 'Whole fish, charred lemon, herb oil.', 24, 'Main Course', '1519708227418-c8fd9a32b7a2', { veg: false }),
      item('Coastal Fish Curry', 'Coconut, kokum and curry leaf.', 17.5, 'Main Course', '1455619452474-d2be8b1e70cd', { veg: false }),
      item('Crab Feast Platter', 'Whole mud crab, needs 4 hours notice.', 55, 'Main Course', '1550966871-3ed3cdb5ed0c', { custom: true, veg: false, prep: 4 }),
      item('Mojito', 'Fresh mint, lime and cane sugar.', 6.5, 'Drinks', '1551538827-9c037cb4f32a'),
      item('Lemon Butter Calamari', 'Crisp rings with aioli.', 12, 'Starters', '1604909052743-94e838986d24', { veg: false }),
    ],
  },
  {
    email: 'sunrise@hotelexpress.dev',
    owner: 'Meera Iyer',
    name: 'Sunrise Tiffin House',
    place: '45 Temple Street, Old Town',
    cuisine: 'South Indian • Breakfast',
    phone: '+919812340004',
    banner: img('1630383249896-424e482df921'),
    lat: 19.0176,
    lng: 72.8562,
    delivery: true,
    fee: 1.5,
    minOrder: 8,
    radius: 6,
    avgMinutes: 22,
    open: '06:30',
    close: '15:00',
    rating: 4.4,
    ratingCount: 96,
    verified: true,
    menu: [
      item('Ghee Podi Dosa', 'Crisp dosa with house gunpowder.', 6, 'Breakfast', '1630383249896-424e482df921'),
      item('Idli Sambar (4 pc)', 'Steamed rice cakes, lentil stew.', 4.5, 'Breakfast', '1589301760014-d929f3979dbc'),
      item('Filter Coffee', 'Chicory blend, brewed to order.', 2, 'Drinks', '1509042239860-f550ce710b93'),
      item('Festive Sweet Box', 'Assorted sweets, prepared on order.', 22, 'Desserts', '1666190092159-3171cf0fbb12', { custom: true, prep: 6 }),
      item('Medu Vada (3 pc)', 'Crisp lentil doughnuts with chutney.', 4, 'Breakfast', '1610192244261-3f33de3f55e4'),
    ],
  },
  {
    email: 'urbanwok@hotelexpress.dev',
    owner: 'Kenji Rao',
    name: 'Urban Wok',
    place: 'Tech Park Boulevard, Sector 21',
    cuisine: 'Pan-Asian • Noodles',
    phone: '+919812340005',
    banner: img('1552611052-33e04de081de'),
    lat: 19.05,
    lng: 72.9,
    delivery: true,
    fee: 3,
    minOrder: 15,
    radius: 15,
    avgMinutes: 32,
    open: '11:00',
    close: '22:30',
    rating: 4.2,
    ratingCount: 74,
    verified: true,
    menu: [
      item('Chilli Garlic Ramen', 'Slow-braised broth, chilli oil, soft egg.', 13.5, 'Main Course', '1591814468924-caf88d1232e1', { veg: false }),
      item('Crispy Chilli Tofu', 'Wok-tossed with peppers and sesame.', 10, 'Starters', '1546069901-ba9599a7e63c'),
      item('Bao Trio', 'Steamed buns, three fillings.', 11, 'Starters', '1563245372-f21724e3856d', { veg: false }),
      item('Wok Party Box', 'Family-size noodle and dumpling spread.', 38, 'Main Course', '1552611052-33e04de081de', { custom: true, veg: false, prep: 2.5 }),
      item('Matcha Cheesecake', 'Baked, with black sesame crumb.', 7.5, 'Desserts', '1533134242443-d4fd215305ad'),
    ],
  },
  {
    email: 'casaverde@hotelexpress.dev',
    owner: 'Lucia Fernandes',
    name: 'Casa Verde Trattoria',
    place: '7 Garden Lane, Hill Quarter',
    cuisine: 'Italian • Wood-fired',
    phone: '+919812340006',
    banner: img('1555396273-367ea4eb4db5'),
    lat: 19.033,
    lng: 72.84,
    delivery: true,
    fee: 2,
    minOrder: 20,
    radius: 10,
    avgMinutes: 35,
    open: '12:00',
    close: '23:00',
    rating: 4.6,
    ratingCount: 187,
    // left unverified on purpose so the admin verification queue has work to show
    verified: false,
    menu: [
      item('Margherita Napoletana', 'San Marzano, fior di latte, basil.', 12, 'Pizza', '1574071318508-1cdbab80d002'),
      item('Truffle Mushroom Pizza', 'Wild mushrooms, truffle cream.', 17, 'Pizza', '1513104890138-7c749659a591'),
      item('Handmade Tagliatelle', 'Slow ragù, 6-hour braise.', 15.5, 'Pasta', '1621996346565-e3dbc646d9a9', { veg: false }),
      item('Tiramisu', 'Mascarpone, espresso, cocoa.', 8, 'Desserts', '1571877227200-a0d98ea607e9'),
      item('Celebration Cake', 'Custom sponge, decorated to order.', 45, 'Desserts', '1578985545062-69928b1d9587', { custom: true, prep: 24 }),
    ],
  },
]

export const SEED_CUSTOMERS = [
  { email: 'jane@hotelexpress.dev', name: 'Jane Doe', phone: '+919800000001', address: '221B Maple Residency, Downtown', lat: 19.073, lng: 72.879 },
  { email: 'arjun@hotelexpress.dev', name: 'Arjun Patel', phone: '+919800000002', address: '5 Skyline Towers, West Side', lat: 19.11, lng: 72.87 },
  { email: 'sara@hotelexpress.dev', name: 'Sara Khan', phone: '+919800000003', address: '18 Palm Grove, Hill Quarter', lat: 19.035, lng: 72.842 },
]

export const SEED_STAFF = [
  { name: 'Alice Smith', email: 'alice@hotelexpress.dev', role: 'manager' as const },
  { name: 'Bob Jones', email: 'bob@hotelexpress.dev', role: 'cook' as const },
  { name: 'Charlie Brown', email: 'charlie@hotelexpress.dev', role: 'courier' as const },
]

export const SEED_FAQS = [
  ['How does self-pickup work?', 'Choose “Self-Pickup” at checkout, pick a time slot, and collect your order at the hotel counter at the scheduled time. You pay at the counter when you collect.', 'Orders'],
  ['What payment methods do you support?', 'Currently we only support offline cash payments — Cash on Delivery or Pay at Hotel. Online card and UPI payments will be added in a future phase.', 'Payments'],
  ['Why can’t I pick an earlier time slot?', 'Some dishes are marked “On-Order” and need advance preparation. The scheduler disables any slot earlier than the longest preparation lead time in your cart.', 'Scheduling'],
  ['Can I cancel my order?', 'Yes — while the order is still in the “Placed” stage. Once the hotel accepts it and preparation begins, cancellation is disabled and you should call the hotel directly.', 'Orders'],
  ['Why is home delivery unavailable for a hotel?', 'Each hotel decides whether it offers home delivery. When it is switched off, only self-pickup is offered, and the hotel details page shows an amber notice.', 'Delivery'],
  ['How do I register my restaurant?', 'Choose “Hotel Owner / Distributor” in the sign-up modal. Your listing goes into the admin verification queue and appears on the home feed once approved.', 'Distributors'],
  ['How is the delivery fee calculated?', 'Each hotel sets a flat delivery fee plus a minimum order amount and a delivery radius. The fee is added to your summary only when Home Delivery is selected.', 'Delivery'],
  ['Where can I download my invoice?', 'Open Order History and use “Download Invoice” on any order — a PDF voucher is generated on demand.', 'Payments'],
] as const

export const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'jane@hotelexpress.dev', password: 'Customer1' },
  { label: 'Distributor', email: 'royal@hotelexpress.dev', password: 'Distributor1' },
  { label: 'Admin', email: 'admin@hotelexpress.dev', password: 'Admin1234' },
]
