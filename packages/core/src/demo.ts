import type { Alert, Category, Hex, Order, PointsEntry, Post, Product, RailId, Story, Unit, Vendor } from './types';

/**
 * Demo neighbourhood: Kalbadevi / Zaveri Bazaar / Bhuleshwar, Mumbai.
 * Every stall here is made up. Photos are free Unsplash stand-ins (docs/MEDIA_CREDITS.md).
 */
const H = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * H).toISOString();
const ahead = (h: number) => new Date(Date.now() + h * H).toISOString();
const wallet = (n: number) => `0x${n.toString(16).padStart(4, '0')}${'2e70'.repeat(9)}` as Hex;
const at = (dLat: number, dLng: number) => ({ lat: 18.9502 + dLat, lng: 72.8318 + dLng });

export const CENTER = at(0, 0);
export const ME = { id: 'u_priya', name: 'Priya', wallet: wallet(0xc0de), home: at(-0.0006, -0.0006) };

export const MARKET_VIDEOS = [
  { id: 'awusrJr7YiE', title: 'Veg street food tour, Khau Galli' },
  { id: 'qiJqfk01GXU', title: 'Zaveri Bazar Khau Galli, Kalbadevi' },
  { id: 'KlYGJ2ozSXs', title: 'Dayaram Chappan Masala Namkeen' },
  { id: '9GEeCuPQa-4', title: 'Must-try food at Zaveri Bazar' },
];

// [id, name, owner, category, tagline, bio, dLat, dLng, landmark, market, hours, rating, followers, photos, fresh, offer?, rails?, youtube?, languages?, verified?]
type Row = [string, string, string, Category, string, string, number, number, string, string, string, number, number, string[], boolean, string?, RailId[]?, string[]?, string[]?, boolean?];

const ROWS: Row[] = [
  ['ravi', "Ravi's Fresh Sabzi", 'Ravi Patil', 'vegetables', 'Nashik farm vegetables every Tuesday', 'Third-generation sabziwala. The Nashik truck lands Tuesday and Friday at 6 AM. Pre-order and skip the rush.', 0.0009, -0.0009, 'Mumbadevi Temple gate', 'Kalbadevi', '07:00-21:00', 4.7, 1284, ['veg-1', 'veg-2', 'veg-3', 'veg-5', 'veg-4'], true, '5% off on 3 kg+', undefined, ['awusrJr7YiE'], ['Marathi', 'Hindi']],
  ['chai', 'Anna Chai Point', 'Murugan', 'chai', 'Cutting chai and bun maska since 1998', 'Kulhad chai, cutting chai, masala chai. Open before the market wakes up.', -0.0005, 0.0008, 'Zaveri Bazaar corner', 'Zaveri Bazaar', '06:00-23:00', 4.8, 3420, ['chai-1', 'chai-2', 'chai-4', 'chai-3'], false, undefined, undefined, ['qiJqfk01GXU'], ['Hindi', 'Tamil']],
  ['vada', 'Shankar Vada Pav', 'Shankar Jadhav', 'street-food', 'Garlic chutney vada pav, fresh every 20 min', 'A new batch every 20 minutes. Dry garlic chutney ground in-house.', -0.0013, 0.0016, 'Khau Galli entrance', 'Zaveri Bazaar', '10:00-22:30', 4.6, 4102, ['food-4', 'food-5', 'food-6', 'food-7'], true, 'Free chai with 3 vada pav', ['streetpay-usdt'], ['9GEeCuPQa-4']],
  ['pavbhaji', 'Sardar Pav Bhaji Cart', 'Gurpreet Singh', 'street-food', 'Butter pav bhaji on the big tawa', 'Bhaji simmering from 4 PM. Soft pav, lots of butter. Evenings only.', -0.0018, 0.0004, 'Princess Street signal', 'Kalbadevi', '16:00-00:30', 4.7, 2210, ['food-1', 'food-8', 'food-3'], false, undefined, undefined, undefined, ['Hindi', 'Punjabi']],
  ['pani', 'Bhaiya Pani Puri', 'Ramesh Yadav', 'street-food', 'Six flavours of pani', 'Pudina, hing, lemon, jaljeera, khatta-meetha and the secret one. Filtered water only.', -0.0021, 0.0001, 'Crawford Market lane', 'Kalbadevi', '16:00-23:00', 4.4, 2203, ['pani-1', 'pani-2', 'pani-3'], false, undefined, ['uniswap-usdc']],
  ['mithai', 'Gupta Mithai', 'Neha Gupta', 'sweets', 'Jalebi from 8 AM, kaju katli all day', 'Pure ghee mithai. Jalebi out of the kadhai every morning. Diwali boxes on order.', 0.0006, 0.0023, 'Opp. Zaveri Bazaar post office', 'Zaveri Bazaar', '08:00-22:00', 4.6, 1880, ['sweet-3', 'sweet-1', 'sweet-4', 'sweet-2'], true, '₹20 off on 500 g', undefined, undefined, ['Hindi', 'Gujarati']],
  ['kokan', 'Kokan Fruit Stall', 'Salim Shaikh', 'fruits', 'Seasonal fruit from Ratnagiri', 'Direct from Ratnagiri and Nashik. Lychee season is on.', 0.0017, 0.0009, 'Bhuleshwar Road', 'Bhuleshwar', '08:00-21:00', 4.5, 960, ['fruit-1', 'fruit-3', 'fruit-2', 'fruit-4'], true, undefined, undefined, undefined, ['Hindi', 'Urdu']],
  ['cart', 'Ali Fruit Cart', 'Ali Hussain', 'fruits', 'Pomegranate, apples, kinnow on wheels', 'Moving cart, parked at Lohar Chawl from 5 to 10 PM.', 0.0012, -0.0024, 'Lohar Chawl corner', 'Kalbadevi', '17:00-22:00', 4.4, 410, ['fruit-5', 'fruit-2'], true, undefined, ['streetpay-usdt'], undefined, ['Hindi', 'Urdu']],
  ['phool', 'Laxmi Phool Bhandar', 'Laxmi Kamble', 'flowers', 'Marigold garlands and puja flowers', 'Garlands made at 5 AM. Wedding and puja orders across Kalbadevi.', 0.0022, -0.0006, 'Phool Galli', 'Bhuleshwar', '05:30-20:00', 4.9, 750, ['flower-1', 'flower-2', 'flower-3', 'flower-4'], true, undefined, ['streetpay-usdt'], undefined, ['Marathi'], false],
  ['meena', 'Meena Tai Bhaji', 'Meena Shinde', 'vegetables', 'Leafy greens cut every morning', 'Methi, palak and coriander cut at 5 AM. Usually gone by noon.', -0.0023, -0.0013, 'Dhobi Talao lane', 'Kalbadevi', '06:30-13:00', 4.8, 1520, ['veg-6', 'veg-5', 'veg-4'], true, undefined, ['streetpay-usdt'], undefined, ['Marathi']],
  ['dosa', 'Udupi Dosa Cart', 'Prakash Shetty', 'south-indian', 'Butter masala dosa on a tawa cart', 'Batter ground every night. Coconut chutney made twice a day.', 0.0026, 0.0015, 'Bhuleshwar market end', 'Bhuleshwar', '07:00-12:00', 4.7, 2050, ['dosa-1', 'dosa-2', 'dosa-3'], false, undefined, undefined, undefined, ['Kannada', 'Hindi']],
  ['shree', 'Shree Medicals', 'Anil Mehta', 'pharmacy', 'Licensed chemist, open till midnight', 'Prescription medicines, first aid and baby care. Pharmacist on duty. Prescription items need a photo of the prescription.', -0.0002, -0.0017, 'Kalbadevi Road', 'Kalbadevi', '08:00-00:00', 4.8, 890, ['pharm-1', 'pharm-2', 'pharm-3', 'pharm-4'], false, 'Free BP check', undefined, undefined, ['Hindi', 'Gujarati', 'English']],
  ['janta', 'Janta Chemist', 'Farida Khan', 'pharmacy', 'Generic medicines, 24 hours', 'Generic medicines at fair prices. Ring the night bell at the shutter.', 0.0019, 0.0027, 'Bhuleshwar, opp. bank', 'Bhuleshwar', '00:00-23:59', 4.6, 540, ['pharm-5', 'pharm-3'], false, undefined, undefined, undefined, ['Hindi', 'Urdu']],
  ['prakash', 'Prakash Electricals', 'Prakash Joshi', 'electrical', 'LED bulbs, wires, fans, repairs', 'Authorised dealer for leading brands. Electrician on call for home visits.', 0.0003, -0.0029, 'Lohar Chawl, shop 22', 'Lohar Chawl', '10:00-20:30', 4.5, 620, ['elec-1', 'elec-2', 'elec-3'], false, 'Diwali lights 15% off', undefined, undefined, ['Hindi', 'Gujarati']],
  ['bharat', 'Bharat Hardware', 'Kiran Desai', 'hardware', 'Tools, paint, locks, plumbing', 'Everything for the house fix. Paint tinting in store.', -0.0008, -0.0026, 'Lohar Chawl main road', 'Lohar Chawl', '09:30-20:00', 4.4, 380, ['hw-1', 'hw-2', 'hw-3', 'hw-4'], false, undefined, undefined, undefined, ['Hindi', 'Gujarati']],
  ['sai', 'Sai Mobile Repair', 'Sai Kiran', 'mobile', 'Screens, batteries, 30-minute fixes', 'Screen replacement while you wait. Three-month warranty on parts.', 0.0012, -0.0019, 'Near Lohar Chawl', 'Kalbadevi', '11:00-21:00', 4.2, 630, ['phone-1', 'phone-2', 'phone-3'], false, undefined, undefined, undefined, ['Hindi', 'Telugu']],
  ['navneet', 'Navneet Stationers', 'Jignesh Shah', 'stationery', 'School, office, xerox, printing', 'Notebooks, art supplies, xerox and printouts. Bulk office orders.', -0.0016, -0.0021, 'Dhobi Talao, near school', 'Dhobi Talao', '09:00-21:00', 4.5, 290, ['stat-1', 'book-2'], false, undefined, undefined, undefined, ['Gujarati', 'Hindi']],
  ['kitab', 'Kitab Corner', 'Rehana Patel', 'books', 'Second-hand books and exam guides', 'Old and new books. Bring your old textbooks to sell.', -0.0025, 0.0011, 'Near Metro Cinema', 'Dhobi Talao', '11:00-21:00', 4.7, 470, ['book-1', 'book-2'], false, undefined, ['streetpay-usdt'], undefined, ['Hindi', 'Urdu', 'English']],
  ['irani', 'Irani Bakery', 'Rustom Irani', 'bakery', 'Brun pav and khari, fresh at 7 AM', 'Wood-fired oven. First batch of brun pav at 7.', 0.0001, 0.0013, 'Zaveri Bazaar back lane', 'Zaveri Bazaar', '07:00-19:00', 4.8, 1710, ['bake-1', 'bake-2', 'bake-3'], true, undefined, undefined, undefined, ['Hindi', 'Gujarati', 'English']],
  ['krishna', 'Krishna Dairy', 'Govind Yadav', 'dairy', 'Fresh milk, dahi, paneer, ghee', 'Milk twice a day from Palghar. Paneer set every afternoon.', 0.0015, 0.0002, 'Bhuleshwar, near temple', 'Bhuleshwar', '05:30-22:00', 4.6, 840, ['milk-1', 'milk-2'], true],
  ['shah', 'Shah Kirana Stores', 'Bhavesh Shah', 'kirana', 'Atta, dal, rice, oil, daily needs', 'Your monthly ration in one bag. Delivery within Kalbadevi.', -0.0004, 0.0001, 'Sheikh Memon Street', 'Kalbadevi', '08:00-22:00', 4.5, 1110, ['spice-5', 'spice-3', 'spice-2'], false, '₹50 off on ₹999', undefined, undefined, ['Gujarati', 'Hindi']],
  ['masala', 'Masala Mahal', 'Yusuf Merchant', 'spices', 'Whole and ground spices by weight', 'Kashmiri chilli and garam masala ground to order. Since 1971.', 0.0008, 0.0031, 'Masjid Bunder lane', 'Masjid Bunder', '09:00-20:00', 4.8, 1320, ['spice-1', 'spice-4', 'spice-2'], true, undefined, undefined, undefined, ['Hindi', 'Urdu', 'Gujarati']],
  ['koli', 'Koli Fish Stall', 'Sunita Koli', 'fish', 'Pomfret, bombil, prawns, morning catch', 'Sassoon Dock catch, cleaned and cut to order. Best before 10 AM.', -0.0028, -0.0003, 'Crawford Market fish section', 'Crawford Market', '06:00-13:00', 4.6, 690, ['fish-1', 'fish-2'], true, undefined, ['streetpay-usdt'], undefined, ['Marathi']],
  ['imran', 'Fast Fix Tailor', 'Imran Ansari', 'tailor', 'Alterations in 30 minutes', 'Hemming, blouse fitting, zip changes. Same day.', -0.0009, -0.0021, 'Kalbadevi Road, stall 14', 'Kalbadevi', '10:00-20:00', 4.3, 410, ['tailor-1', 'tailor-2', 'tailor-3'], false, undefined, ['streetpay-usdt'], undefined, ['Hindi', 'Urdu'], false],
  ['style', 'Style Point Salon', 'Arif Salmani', 'salon', 'Haircut, shave, beard styling', 'Walk-ins welcome. Book a slot and skip the wait.', 0.0004, -0.0012, 'Mumbadevi Road', 'Kalbadevi', '09:00-21:30', 4.5, 760, ['barber-1', 'barber-2', 'barber-3'], false, undefined, undefined, undefined, ['Hindi', 'Urdu']],
];

export const VENDORS: Vendor[] = ROWS.map((r, i) => ({
  id: r[0], name: r[1], owner: r[2], category: r[3], tagline: r[4], bio: r[5], location: at(r[6], r[7]),
  landmark: r[8], market: r[9], hours: r[10], rating: r[11], followers: r[12], photos: r[13], fresh: r[14],
  offer: r[15], rails: r[16] ?? ['streetpay-usdt', 'uniswap-usdc'], youtube: r[17] ?? [], languages: r[18] ?? ['Hindi', 'Marathi'],
  verified: r[19] ?? true, avatar: r[13][0], cover: r[13][1] ?? r[13][0], wallet: wallet(i + 1),
}));

const F = { freshUntil: ahead(18) };
type P = [string, string, string, Unit, number, number, string, Partial<Product>?];
const PROWS: P[] = [
  ['tomato', 'ravi', 'Tomatoes', 'kg', 30, 20, 'veg-3', { local: 'टोमॅटो', ...F }],
  ['basket', 'ravi', 'Mixed veg basket', 'kg', 60, 12, 'veg-5', F],
  ['spinach', 'ravi', 'Spinach', 'bunch', 20, 12, 'veg-6', { local: 'पालक', ...F }],
  ['onion', 'ravi', 'Onions', 'kg', 40, 35, 'veg-2', { local: 'कांदा' }],
  ['carrot', 'ravi', 'Carrots & peppers', 'kg', 50, 8, 'veg-4', F],
  ['cutting', 'chai', 'Cutting chai', 'cup', 12, 200, 'chai-3'],
  ['kulhad', 'chai', 'Kulhad chai', 'cup', 25, 120, 'chai-1'],
  ['bun', 'chai', 'Bun maska', 'plate', 30, 40, 'bake-2'],
  ['vadapav', 'vada', 'Vada pav', 'piece', 20, 80, 'food-4', F],
  ['samosa', 'vada', 'Samosa', 'piece', 18, 50, 'food-5'],
  ['bhajji', 'vada', 'Bhajji plate', 'plate', 30, 30, 'food-6'],
  ['pavbhaji', 'pavbhaji', 'Butter pav bhaji', 'plate', 120, 60, 'food-1'],
  ['corn', 'pavbhaji', 'Roasted bhutta', 'piece', 40, 30, 'food-8'],
  ['panipuri', 'pani', 'Pani puri (6)', 'plate', 40, 100, 'pani-1'],
  ['sevpuri', 'pani', 'Sev puri', 'plate', 50, 60, 'pani-3'],
  ['jalebi', 'mithai', 'Jalebi', '250g', 80, 20, 'sweet-3', F],
  ['jamun', 'mithai', 'Gulab jamun', '250g', 90, 25, 'sweet-1'],
  ['kaju', 'mithai', 'Kaju katli', '250g', 260, 15, 'sweet-4'],
  ['lychee', 'kokan', 'Lychee', 'kg', 220, 10, 'fruit-3', F],
  ['fruitbox', 'kokan', 'Seasonal fruit box', 'kg', 180, 15, 'fruit-1', F],
  ['banana', 'kokan', 'Bananas', 'dozen', 60, 25, 'fruit-4'],
  ['anar', 'cart', 'Pomegranate', 'kg', 160, 20, 'fruit-5', F],
  ['garland', 'phool', 'Marigold garland', 'piece', 40, 30, 'flower-2', F],
  ['petals', 'phool', 'Rose & marigold petals', '250g', 50, 12, 'flower-1', F],
  ['methi', 'meena', 'Methi', 'bunch', 15, 25, 'veg-6', F],
  ['dhania', 'meena', 'Coriander', 'bunch', 10, 40, 'veg-5', F],
  ['masaladosa', 'dosa', 'Butter masala dosa', 'plate', 90, 40, 'dosa-1'],
  ['leafdosa', 'dosa', 'Banana-leaf dosa', 'plate', 110, 30, 'dosa-2'],
  ['para', 'shree', 'Paracetamol 650 (strip)', 'piece', 32, 80, 'pharm-4'],
  ['ors', 'shree', 'ORS sachets (5)', 'piece', 105, 40, 'pharm-5'],
  ['firstaid', 'shree', 'First-aid kit', 'piece', 349, 12, 'pharm-3'],
  ['vitc', 'janta', 'Vitamin C tablets', 'piece', 60, 50, 'pharm-4'],
  ['led', 'prakash', 'LED bulb 9W', 'piece', 99, 60, 'elec-1'],
  ['lights', 'prakash', 'Diwali light string', 'piece', 249, 40, 'elec-3'],
  ['board', 'prakash', 'Extension board', 'piece', 399, 15, 'elec-2'],
  ['paint', 'bharat', 'Paint 1 L', 'piece', 420, 25, 'hw-2'],
  ['tools', 'bharat', 'Screwdriver set', 'piece', 299, 18, 'hw-1'],
  ['guard', 'sai', 'Screen guard fitted', 'service', 150, 40, 'phone-2'],
  ['battery', 'sai', 'Battery replacement', 'service', 900, 10, 'phone-3'],
  ['notebook', 'navneet', 'Notebook 200 pages', 'piece', 60, 100, 'stat-1'],
  ['xerox', 'navneet', 'Xerox (per page)', 'piece', 2, 999, 'stat-1'],
  ['novel', 'kitab', 'Used novel', 'piece', 120, 60, 'book-1'],
  ['brun', 'irani', 'Brun pav (4)', 'plate', 40, 50, 'bake-3', F],
  ['khari', 'irani', 'Khari biscuits', '250g', 70, 30, 'bake-1'],
  ['milk', 'krishna', 'Fresh milk 500 ml', 'piece', 34, 100, 'milk-1', F],
  ['paneer', 'krishna', 'Paneer', '250g', 110, 20, 'milk-2', F],
  ['atta', 'shah', 'Atta 5 kg', 'piece', 245, 30, 'spice-5'],
  ['dal', 'shah', 'Toor dal 1 kg', 'piece', 165, 40, 'spice-3'],
  ['garam', 'masala', 'Garam masala', '250g', 140, 30, 'spice-1', F],
  ['chilli', 'masala', 'Kashmiri chilli powder', '250g', 120, 40, 'spice-4'],
  ['pomfret', 'koli', 'Pomfret', 'kg', 900, 8, 'fish-1', F],
  ['bombil', 'koli', 'Bombil', 'kg', 300, 12, 'fish-2', F],
  ['hem', 'imran', 'Trouser alteration', 'service', 120, 99, 'tailor-2'],
  ['blouse', 'imran', 'Blouse fitting', 'service', 200, 99, 'tailor-1'],
  ['haircut', 'style', 'Haircut', 'service', 150, 99, 'barber-1'],
  ['shave', 'style', 'Shave & beard', 'service', 100, 99, 'barber-3'],
];
export const PRODUCTS: Product[] = PROWS.map(([id, v, name, unit, priceInr, stock, image, extra]) => ({ id, vendorId: v, name, unit, priceInr, stock, image, ...extra }));

const CAPTIONS: Partial<Record<Category, string[]>> & { other: string[] } = {
  vegetables: ['Nashik truck just landed. Tomatoes look great today.', 'Tuesday is fresh day. Pre-order and pick up on your way to work.', 'Greens cut at 5 AM. Gone by noon.'],
  chai: ['First kulhad of the morning.', 'Cutting chai and bun maska. The Kalbadevi breakfast.', 'Rain outside, adrak chai inside.'],
  'street-food': ['Fresh batch every 20 minutes.', 'Chutney ground this morning.', 'Evening rush starts at 6. Pre-order to skip the line.'],
  sweets: ['Jalebi straight from the kadhai.', 'Diwali boxes are ready. Order early.'],
  fruits: ['Lychee season is here.', 'Ratnagiri stock just arrived.'],
  flowers: ['Garlands for Lakshmi puja. Limited stock.', 'Made at 5 AM, still fresh at 5 PM.'],
  pharmacy: ['Free BP check this week.', 'Open till midnight. Ring the bell after 10.'],
  electrical: ['Diwali lights are in. 15% off.', 'Book an electrician for a home visit.'],
  other: ['New stock in today.', 'Thank you Kalbadevi for 1,000 followers.'],
};

export const POSTS: Post[] = VENDORS.flatMap((v, vi) =>
  v.photos.slice(0, 3).map((m, i) => {
    const caps = CAPTIONS[v.category] ?? CAPTIONS.other;
    return {
      id: `post-${v.id}-${i}`,
      vendorId: v.id,
      media: i === 0 && v.photos[2] ? [m, v.photos[2]] : [m],
      caption: caps[i % caps.length],
      likes: 40 + ((vi * 37 + i * 91) % 900),
      comments: 2 + ((vi * 7 + i * 5) % 60),
      at: ago(1 + vi * 0.9 + i * 13),
      tag: i === 0 && v.fresh ? 'fresh' : i === 1 && v.offer ? 'offer' : undefined,
      productIds: PRODUCTS.filter((p) => p.vendorId === v.id).slice(0, 2).map((p) => p.id),
    } satisfies Post;
  }),
).sort((a, b) => b.at.localeCompare(a.at));

export const STORIES: Story[] = VENDORS.filter((v) => v.fresh || v.offer).map((v, i) => ({
  id: `story-${v.id}`, vendorId: v.id, media: v.photos[i % 2] ?? v.photos[0], text: v.offer ?? 'Fresh stock just arrived', at: ago(0.5 + i * 0.7),
}));

export const ALERTS: Alert[] = [
  { id: 'al1', vendorId: 'ravi', title: 'Fresh stock from Nashik', body: 'Tomatoes, spinach and carrots just arrived. Available from 7 AM today.', translations: { Hindi: 'नासिक से ताज़ी सब्ज़ी आई है: टमाटर, पालक और गाजर।', Marathi: 'नाशिकहून ताजी भाजी आली आहे: टोमॅटो, पालक आणि गाजर.' }, productIds: ['tomato', 'spinach', 'carrot'], at: ago(2), aiRequestId: 'demo-7f3a91' },
  { id: 'al2', vendorId: 'irani', title: 'Brun pav out of the oven', body: 'First batch at 7 AM. Khari biscuits restocked.', translations: {}, productIds: ['brun', 'khari'], at: ago(3) },
];

export const FOLLOWING = ['ravi', 'chai', 'mithai', 'irani'];

const pay = (rail: RailId, usdAmt: number, tx: string, h: number): Order['payment'] => ({
  rail, paidToken: rail === 'uniswap-usdc' ? 'ETH' : 'USDT', paidAmount: rail === 'uniswap-usdc' ? usdAmt / 3000 : usdAmt,
  settled: usdAmt, settledToken: rail === 'uniswap-usdc' ? 'USDC' : 'USDT', chainId: rail === 'uniswap-usdc' ? 1301 : 1874,
  tx: `0x${tx.repeat(16)}` as Hex, at: ago(h), simulated: true,
});

export const MY_ORDERS: Order[] = [
  { id: 'o1021', code: 'KM-412', customer: 'Priya', vendorId: 'chai', lines: [{ productId: 'cutting', name: 'Cutting chai', unit: 'cup', qty: 2, priceInr: 12 }, { productId: 'bun', name: 'Bun maska', unit: 'plate', qty: 1, priceInr: 30 }], inr: 54, usd: 0.64, status: 'done', at: ago(26), payment: pay('streetpay-usdt', 0.64, '8a1d', 26), refunds: [], points: 5 },
  { id: 'o1017', code: 'RT-208', customer: 'Priya', vendorId: 'ravi', lines: [{ productId: 'onion', name: 'Onions', unit: 'kg', qty: 2, priceInr: 40 }, { productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 1, priceInr: 30 }], inr: 110, usd: 1.31, status: 'done', at: ago(74), payment: pay('uniswap-usdc', 1.31, '3c9f', 74), refunds: [], points: 11 },
];

export const VENDOR_ORDERS: Order[] = [
  { id: 'o1024', code: 'AS-731', customer: 'Arjun', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 2, priceInr: 30 }, { productId: 'spinach', name: 'Spinach', unit: 'bunch', qty: 1, priceInr: 20 }], inr: 80, usd: 0.95, status: 'paid', at: ago(0.3), payment: pay('streetpay-usdt', 0.95, '5d2e', 0.3), refunds: [], points: 8 },
  { id: 'o1023', code: 'NB-118', customer: 'Nisha', vendorId: 'ravi', lines: [{ productId: 'onion', name: 'Onions', unit: 'kg', qty: 3, priceInr: 40 }], inr: 120, usd: 1.43, status: 'ready', at: ago(1.1), payment: pay('uniswap-usdc', 1.43, '9e7c', 1.1), refunds: [], points: 12 },
  { id: 'o1019', code: 'DK-590', customer: 'Dev', vendorId: 'ravi', lines: [{ productId: 'basket', name: 'Mixed veg basket', unit: 'kg', qty: 1, priceInr: 60 }], inr: 60, usd: 0.71, status: 'done', at: ago(4), payment: pay('streetpay-usdt', 0.71, '1f3e', 4), refunds: [], points: 6 },
  { id: 'oh1', code: 'HX-100', customer: 'Arjun', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 2, priceInr: 30 }], inr: 60, usd: 0.71, status: 'done', at: ago(30), payment: pay('streetpay-usdt', 0.71, 'a0b0', 30), refunds: [], points: 6 },
  { id: 'oh2', code: 'HX-101', customer: 'Arjun', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 3, priceInr: 30 }], inr: 90, usd: 1.07, status: 'done', at: ago(75), payment: pay('streetpay-usdt', 1.07, 'a1b1', 75), refunds: [], points: 9 },
  { id: 'oh3', code: 'HX-102', customer: 'Arjun', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 1, priceInr: 30 }], inr: 30, usd: 0.36, status: 'done', at: ago(122), payment: pay('streetpay-usdt', 0.36, 'a2b2', 122), refunds: [], points: 3 },
  { id: 'oh4', code: 'HX-103', customer: 'Arjun', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 2, priceInr: 30 }], inr: 60, usd: 0.71, status: 'done', at: ago(170), payment: pay('streetpay-usdt', 0.71, 'a3b3', 170), refunds: [], points: 6 },
  { id: 'oh5', code: 'HX-104', customer: 'Arjun', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 2, priceInr: 30 }], inr: 60, usd: 0.71, status: 'done', at: ago(220), payment: pay('streetpay-usdt', 0.71, 'a4b4', 220), refunds: [], points: 6 },
  { id: 'oh6', code: 'HX-105', customer: 'Nisha', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 3, priceInr: 30 }], inr: 90, usd: 1.07, status: 'done', at: ago(48), payment: pay('streetpay-usdt', 1.07, 'a5b5', 48), refunds: [], points: 9 },
  { id: 'oh7', code: 'HX-106', customer: 'Nisha', vendorId: 'ravi', lines: [{ productId: 'tomato', name: 'Tomatoes', unit: 'kg', qty: 4, priceInr: 30 }], inr: 120, usd: 1.43, status: 'done', at: ago(140), payment: pay('streetpay-usdt', 1.43, 'a6b6', 140), refunds: [], points: 12 },
];

export const POINTS: PointsEntry[] = [
  { id: 'pt1', points: 11, label: "Order at Ravi's Fresh Sabzi", at: ago(74), vendorId: 'ravi' },
  { id: 'pt0', points: 34, label: "Earlier visits at Ravi's Fresh Sabzi", at: ago(400), vendorId: 'ravi' },
  { id: 'pt2', points: 5, label: 'Order at Anna Chai Point', at: ago(26), vendorId: 'chai' },
  { id: 'pt3', points: 20, label: 'Welcome bonus from Anna Chai Point', at: ago(26), vendorId: 'chai' },
];

export const REWARDS = [
  { id: 'rw1', vendorId: 'chai', label: 'Free cutting chai', cost: 30 },
  { id: 'rw2', vendorId: 'ravi', label: "₹25 off at Ravi's", cost: 50 },
  { id: 'rw3', vendorId: 'mithai', label: '100 g jalebi free', cost: 80 },
];

/** Kept for old screens; loyalty is per stall now (see loyalty.ts). */
export const TIERS = [
  { name: 'New', at: 0 },
  { name: 'Regular', at: 3 },
  { name: 'Favourite', at: 8 },
  { name: 'Family', at: 20 },
];

export const WEEK_INR = [1820, 2410, 1990, 3120, 2780, 4050, 2340];
