/**
 * The lifestyle track: a month of ordinary Indian eating.
 *
 * This is the other half of the app. Someone on the fitness track weighs their
 * food against a calculated target; someone on the lifestyle track just wants
 * four sensible meals a day that happen to be light, and a video to hand the
 * person cooking. No logging, no solver, no grams.
 *
 * Every dish here is vegetarian, home-style, and sits in a band that keeps an
 * ordinary day between roughly 1,300 and 1,600 kcal before anything is added
 * to it. The calorie and protein figures are per the serving described, taken
 * from IFCT 2017 and USDA FoodData Central composites for the dish as it is
 * normally cooked in a home kitchen — one to two teaspoons of oil, not a
 * restaurant's ladle. They are honest estimates for a plate, not measurements
 * of yours.
 *
 * The calendar is *generated* rather than typed out. Thirty days times four
 * slots times three options is 360 entries, and a hand-written table that size
 * is a table with mistakes in it. Instead each slot walks its own pool at its
 * own stride, which is provably coprime with the pool size, so every dish comes
 * round, no day repeats the day before it, and the four slots do not move in
 * lockstep. The validator checks all of that rather than trusting this comment.
 */

import { MONTH_DAYS, youtubeSearchUrl } from "./nutrition";

export { MONTH_DAYS };

export type SlotKey = "breakfast" | "lunch" | "snack" | "dinner";

export interface Slot { k: SlotKey; n: string; hi: string; t: string }

export const SLOTS: Slot[] = [
  { k: "breakfast", n: "Breakfast",     hi: "नाश्ता",       t: "08:00 – 10:00" },
  { k: "lunch",     n: "Lunch",         hi: "दोपहर का खाना", t: "13:00 – 14:30" },
  { k: "snack",     n: "Evening snack", hi: "शाम का नाश्ता", t: "17:00 – 18:30" },
  { k: "dinner",    n: "Dinner",        hi: "रात का खाना",   t: "19:30 – 21:00" },
];

export interface Dish {
  /** Stable id — a pinned cooking video is keyed on it, so it must not drift. */
  id: string;
  en: string;
  hi: string;
  /** kcal for the serving named below. */
  k: number;
  /** protein, g, for the same serving. */
  p: number;
  serve: string;
  serveHi: string;
  /** One short reason this dish earns its place on a light day. */
  why: string;
}

/* ------------------------------------------------------------------- the pools */

const BREAKFAST: Dish[] = [
  { id: "l-masala-oats", en: "Masala Oats", hi: "मसाला ओट्स", k: 260, p: 9,
    serve: "1 katori, with vegetables", serveHi: "1 कटोरी, सब्ज़ियों के साथ",
    why: "Beta-glucan keeps you full to lunch on very few calories." },
  { id: "l-besan-chilla", en: "Besan Chilla", hi: "बेसन चीला", k: 300, p: 13,
    serve: "2 chilla with mint chutney", serveHi: "2 चीला, पुदीने की चटनी के साथ",
    why: "Gram flour is a third protein by dry weight — rare in a breakfast." },
  { id: "l-moong-chilla", en: "Moong Dal Chilla", hi: "मूंग दाल चीला", k: 280, p: 15,
    serve: "2 chilla with curd", serveHi: "2 चीला, दही के साथ",
    why: "The highest-protein breakfast in this list, and the lightest to digest." },
  { id: "l-veg-poha", en: "Vegetable Poha", hi: "सब्ज़ी वाला पोहा", k: 300, p: 7,
    serve: "1 plate, 1 tsp oil", serveHi: "1 प्लेट, 1 छोटा चम्मच तेल",
    why: "Peas, carrot and peanuts turn a plain carb into a balanced plate." },
  { id: "l-veg-upma", en: "Vegetable Upma", hi: "सब्ज़ी उपमा", k: 290, p: 7,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "Cheap, fast, and the vegetables go in without anyone noticing." },
  { id: "l-idli-sambar", en: "Idli Sambar", hi: "इडली सांभर", k: 310, p: 11,
    serve: "3 idli with a bowl of sambar", serveHi: "3 इडली, एक कटोरी सांभर",
    why: "Steamed, fermented, and no oil touches it at any point." },
  { id: "l-ragi-dosa", en: "Ragi Dosa", hi: "रागी डोसा", k: 280, p: 8,
    serve: "2 dosa with chutney", serveHi: "2 डोसा, चटनी के साथ",
    why: "Finger millet carries far more calcium and fibre than rice flour." },
  { id: "l-namkeen-dalia", en: "Namkeen Dalia", hi: "नमकीन दलिया", k: 270, p: 9,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "Broken wheat holds its fibre, so the same calories last longer." },
  { id: "l-oats-idli", en: "Oats Idli", hi: "ओट्स इडली", k: 250, p: 9,
    serve: "3 idli with sambar", serveHi: "3 इडली, सांभर के साथ",
    why: "The lightest breakfast here — worth knowing on a heavy lunch day." },
  { id: "l-sprouts-bowl", en: "Sprouts Chaat", hi: "अंकुरित चाट", k: 230, p: 14,
    serve: "1 katori with lemon and onion", serveHi: "1 कटोरी, नींबू और प्याज़",
    why: "Sprouting raises the protein you can actually absorb." },
  { id: "l-paneer-toast", en: "Paneer Bhurji on Brown Toast", hi: "पनीर भुर्जी टोस्ट", k: 340, p: 20,
    serve: "2 slices with bhurji", serveHi: "2 स्लाइस, भुर्जी के साथ",
    why: "Twenty grams of protein before nine in the morning." },
  { id: "l-methi-thepla", en: "Methi Thepla with Curd", hi: "मेथी थेपला", k: 330, p: 11,
    serve: "2 thepla, 1 katori curd", serveHi: "2 थेपला, 1 कटोरी दही",
    why: "Travels, keeps, and needs nothing reheated." },
  { id: "l-suji-cheela", en: "Suji Vegetable Cheela", hi: "सूजी चीला", k: 290, p: 8,
    serve: "2 cheela", serveHi: "2 चीला",
    why: "Ten minutes, one pan, no fermenting or soaking the night before." },
  { id: "l-dhokla-b", en: "Besan Dhokla", hi: "बेसन ढोकला", k: 250, p: 10,
    serve: "4 pieces", serveHi: "4 टुकड़े",
    why: "Steamed and fermented — filling for how little it weighs." },
  { id: "l-quinoa-upma", en: "Quinoa Upma", hi: "क्विनोआ उपमा", k: 300, p: 10,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "One of very few plant foods with the full amino acid set." },
  { id: "l-curd-fruit-chia", en: "Curd, Fruit and Chia Bowl", hi: "दही फल चिया बाउल", k: 260, p: 12,
    serve: "1 bowl", serveHi: "1 बाउल",
    why: "No cooking at all, for the mornings when there is no time." },
  { id: "l-multigrain-paratha", en: "Multigrain Paratha with Curd", hi: "मल्टीग्रेन पराठा", k: 320, p: 11,
    serve: "1 paratha, 1 katori curd", serveHi: "1 पराठा, 1 कटोरी दही",
    why: "A paratha stays on the menu — one, not three, and cooked dry." },
  { id: "l-banana-pb-shake", en: "Banana Peanut Butter Shake", hi: "केला पीनट बटर शेक", k: 330, p: 14,
    serve: "1 tall glass", serveHi: "1 बड़ा गिलास",
    why: "Ninety seconds, and it beats skipping breakfast by a mile." },
  { id: "l-veg-seviyan", en: "Vegetable Seviyan", hi: "सब्ज़ी सेवइयाँ", k: 280, p: 7,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "Familiar enough that children eat it without argument." },
  { id: "l-palak-paratha", en: "Palak Paratha with Curd", hi: "पालक पराठा", k: 310, p: 10,
    serve: "1 paratha, 1 katori curd", serveHi: "1 पराठा, 1 कटोरी दही",
    why: "A whole bunch of spinach disappears into the dough." },
  { id: "l-ragi-porridge", en: "Ragi Porridge", hi: "रागी पोरिज", k: 250, p: 8,
    serve: "1 glass", serveHi: "1 गिलास",
    why: "Warm, sweet, and gentler on the stomach than anything fried." },
  { id: "l-tofu-bhurji-b", en: "Tofu Bhurji with Roti", hi: "टोफू भुर्जी", k: 320, p: 18,
    serve: "1 katori bhurji, 1 roti", serveHi: "1 कटोरी भुर्जी, 1 रोटी",
    why: "Paneer's protein without paneer's fat." },
  { id: "l-sprout-pulao-b", en: "Sprouted Moong Pulao", hi: "अंकुरित मूंग पुलाव", k: 300, p: 14,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "Last night's rice, made worth eating again." },
];

const LUNCH: Dish[] = [
  { id: "l-dal-roti-sabzi", en: "Dal, Roti and a Dry Sabzi", hi: "दाल रोटी सब्ज़ी", k: 470, p: 18,
    serve: "1 katori dal, 2 roti, 1 katori sabzi", serveHi: "1 कटोरी दाल, 2 रोटी, 1 कटोरी सब्ज़ी",
    why: "The default Indian plate, and it was always the right one." },
  { id: "l-rajma-chawal", en: "Rajma with Brown Rice", hi: "राजमा चावल", k: 480, p: 18,
    serve: "1 katori rajma, 1 katori rice", serveHi: "1 कटोरी राजमा, 1 कटोरी चावल",
    why: "Kidney beans digest slowly enough to hold off the 4 pm slump." },
  { id: "l-chole-roti", en: "Chole with Roti", hi: "छोले रोटी", k: 470, p: 19,
    serve: "1 katori chole, 2 roti", serveHi: "1 कटोरी छोले, 2 रोटी",
    why: "Chickpeas bring protein and fibre in the same spoon." },
  { id: "l-khichdi-curd", en: "Moong Dal Khichdi with Curd", hi: "खिचड़ी और दही", k: 430, p: 18,
    serve: "1 plate khichdi, 1 katori curd", serveHi: "1 प्लेट खिचड़ी, 1 कटोरी दही",
    why: "One pot, one flame, and nothing left to wash." },
  { id: "l-palak-paneer-lunch", en: "Palak Paneer with Roti", hi: "पालक पनीर रोटी", k: 500, p: 23,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Iron from the spinach, and the paneer to carry it." },
  { id: "l-veg-pulao-raita", en: "Vegetable Pulao with Raita", hi: "वेज पुलाव रायता", k: 450, p: 12,
    serve: "1 plate pulao, 1 katori raita", serveHi: "1 प्लेट पुलाव, 1 कटोरी रायता",
    why: "Cooks in one vessel and packs into a tiffin without going soggy." },
  { id: "l-curd-rice", en: "Curd Rice with Salad", hi: "दही चावल", k: 400, p: 13,
    serve: "1 plate with cucumber", serveHi: "1 प्लेट, खीरे के साथ",
    why: "The lightest lunch here, and the one that survives a hot afternoon." },
  { id: "l-soya-curry-roti", en: "Soya Chunk Curry with Roti", hi: "सोया करी रोटी", k: 480, p: 27,
    serve: "1 katori curry, 2 roti", serveHi: "1 कटोरी करी, 2 रोटी",
    why: "The most protein on this list, for the least money." },
  { id: "l-lauki-chana-dal", en: "Lauki Chana Dal with Roti", hi: "लौकी चना दाल", k: 440, p: 17,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Bottle gourd adds volume and almost no calories." },
  { id: "l-bhindi-dal-roti", en: "Bhindi, Dal and Roti", hi: "भिंडी दाल रोटी", k: 460, p: 16,
    serve: "1 katori each, 2 roti", serveHi: "1-1 कटोरी, 2 रोटी",
    why: "Okra cooked dry, not deep-fried, is a different food entirely." },
  { id: "l-sambar-rice", en: "Sambar Rice with Poriyal", hi: "सांभर चावल", k: 450, p: 14,
    serve: "1 plate, 1 katori poriyal", serveHi: "1 प्लेट, 1 कटोरी पोरियल",
    why: "Toor dal and six vegetables in one gravy." },
  { id: "l-kadhi-chawal", en: "Kadhi with Rice", hi: "कढ़ी चावल", k: 440, p: 13,
    serve: "1 katori kadhi, 1 katori rice", serveHi: "1 कटोरी कढ़ी, 1 कटोरी चावल",
    why: "Curd-based, so the protein arrives without any meat substitute." },
  { id: "l-matar-paneer", en: "Matar Paneer with Roti", hi: "मटर पनीर रोटी", k: 510, p: 22,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "The Sunday dish, cooked in a way that fits a Tuesday." },
  { id: "l-baingan-bharta", en: "Baingan Bharta with Roti", hi: "बैंगन भरता रोटी", k: 430, p: 13,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Roasted, not fried — the smoke does the work oil usually does." },
  { id: "l-masoor-dal-rice", en: "Masoor Dal with Rice and Salad", hi: "मसूर दाल चावल", k: 450, p: 18,
    serve: "1 katori dal, 1 katori rice", serveHi: "1 कटोरी दाल, 1 कटोरी चावल",
    why: "Cooks in fifteen minutes without soaking." },
  { id: "l-methi-dal-jowar", en: "Methi Dal with Jowar Roti", hi: "मेथी दाल जोवार रोटी", k: 430, p: 17,
    serve: "1 katori dal, 2 jowar roti", serveHi: "1 कटोरी दाल, 2 जोवार रोटी",
    why: "Sorghum instead of wheat, for the days that feel heavy." },
  { id: "l-mix-veg-lunch", en: "Mixed Vegetables with Dal and Roti", hi: "मिक्स वेज रोटी", k: 460, p: 16,
    serve: "1 katori each, 2 roti", serveHi: "1-1 कटोरी, 2 रोटी",
    why: "Whatever the fridge has, cooked dry with cumin." },
  { id: "l-kala-chana", en: "Kala Chana Sabzi with Roti", hi: "काला चना रोटी", k: 470, p: 20,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Black chana holds more fibre than the white kind." },
  { id: "l-paneer-bhurji-lunch", en: "Paneer Bhurji with Roti", hi: "पनीर भुर्जी रोटी", k: 500, p: 24,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Fifteen minutes from fridge to plate." },
  { id: "l-dal-dhokli", en: "Dal Dhokli", hi: "दाल ढोकली", k: 470, p: 16,
    serve: "1 large katori", serveHi: "1 बड़ी कटोरी",
    why: "A whole meal in a single bowl, dal and roti cooked together." },
  { id: "l-veg-dalia-lunch", en: "Vegetable Dalia with Curd", hi: "सब्ज़ी दलिया", k: 410, p: 14,
    serve: "1 plate, 1 katori curd", serveHi: "1 प्लेट, 1 कटोरी दही",
    why: "Lighter than rice, and it does not put you to sleep." },
  { id: "l-tofu-veg-rice", en: "Tofu and Vegetable Brown Rice", hi: "टोफू सब्ज़ी चावल", k: 470, p: 24,
    serve: "1 plate", serveHi: "1 प्लेट",
    why: "High protein with no dairy at all, for anyone who avoids it." },
  { id: "l-sprouts-pulao", en: "Sprouts Pulao with Raita", hi: "अंकुरित पुलाव", k: 440, p: 18,
    serve: "1 plate, 1 katori raita", serveHi: "1 प्लेट, 1 कटोरी रायता",
    why: "Rice, but with the protein problem already solved." },
];

const SNACK: Dish[] = [
  { id: "l-roasted-chana", en: "Roasted Chana", hi: "भुना चना", k: 150, p: 8,
    serve: "1 mutthi (30 g)", serveHi: "1 मुट्ठी (30 ग्राम)",
    why: "Keeps for weeks in a jar and needs no preparation." },
  { id: "l-sprouts-chaat", en: "Sprouts Chaat", hi: "अंकुरित चाट", k: 160, p: 10,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "The most protein per calorie of any snack here." },
  { id: "l-makhana", en: "Roasted Makhana", hi: "भुना मखाना", k: 130, p: 4,
    serve: "1 bowl (25 g)", serveHi: "1 बाउल (25 ग्राम)",
    why: "A large bowl for very little — it is mostly air." },
  { id: "l-light-bhel", en: "Light Bhel", hi: "हल्का भेल", k: 170, p: 5,
    serve: "1 katori, no sev", serveHi: "1 कटोरी, बिना सेव",
    why: "Street food minus the fried part, which was most of the calories." },
  { id: "l-corn-chaat", en: "Boiled Corn Chaat", hi: "भुट्टा चाट", k: 150, p: 5,
    serve: "1 katori with lemon", serveHi: "1 कटोरी, नींबू के साथ",
    why: "Sweet enough to stand in for something fried." },
  { id: "l-fruit-green-tea", en: "Seasonal Fruit with Green Tea", hi: "मौसमी फल और ग्रीन टी", k: 120, p: 2,
    serve: "1 fruit, 1 cup", serveHi: "1 फल, 1 कप",
    why: "The lightest option, for days when lunch ran long." },
  { id: "l-chaas-murmura", en: "Buttermilk with Murmura", hi: "छाछ और मुरमुरा", k: 140, p: 5,
    serve: "1 glass, 1 katori", serveHi: "1 गिलास, 1 कटोरी",
    why: "Cools you down and settles a heavy lunch." },
  { id: "l-dhokla-s", en: "Besan Dhokla", hi: "बेसन ढोकला", k: 150, p: 6,
    serve: "3 pieces", serveHi: "3 टुकड़े",
    why: "Made in the morning, eaten at five, no reheating." },
  { id: "l-chikki", en: "Peanut Chikki", hi: "मूंगफली चिक्की", k: 130, p: 4,
    serve: "1 small piece", serveHi: "1 छोटा टुकड़ा",
    why: "The sweet craving, answered with something that has protein in it." },
  { id: "l-curd-flax", en: "Curd with Flaxseed", hi: "दही और अलसी", k: 140, p: 9,
    serve: "1 katori, 1 tsp flax", serveHi: "1 कटोरी, 1 छोटा चम्मच अलसी",
    why: "Omega-3 from a seed, since there is no fish on this plan." },
  { id: "l-khakhra-chai", en: "Masala Chai with Khakhra", hi: "चाय और खाखरा", k: 180, p: 6,
    serve: "1 cup, 2 khakhra", serveHi: "1 कप, 2 खाखरा",
    why: "The chai is happening anyway — this decides what goes with it." },
  { id: "l-hummus-sticks", en: "Cucumber and Carrot with Hummus", hi: "खीरा गाजर और हम्मस", k: 150, p: 5,
    serve: "1 plate, 2 tbsp hummus", serveHi: "1 प्लेट, 2 बड़े चम्मच हम्मस",
    why: "Crunch, which is usually what the craving actually wants." },
  { id: "l-paneer-tikka-s", en: "Paneer Tikka", hi: "पनीर टिक्का", k: 180, p: 12,
    serve: "4 cubes, grilled", serveHi: "4 टुकड़े, ग्रिल किए हुए",
    why: "Twelve grams of protein between meals, off a tawa with no oil." },
  { id: "l-sattu-drink", en: "Sattu Drink", hi: "सत्तू शरबत", k: 170, p: 8,
    serve: "1 glass, salted", serveHi: "1 गिलास, नमकीन",
    why: "Roasted gram flour and water — a summer drink with real protein." },
  { id: "l-coconut-almond", en: "Coconut Water with Almonds", hi: "नारियल पानी और बादाम", k: 140, p: 4,
    serve: "1 glass, 8 almonds", serveHi: "1 गिलास, 8 बादाम",
    why: "Replaces what a day in Indian heat takes out of you." },
  { id: "l-moong-chilla-s", en: "Moong Dal Chilla, one", hi: "मूंग दाल चीला", k: 140, p: 8,
    serve: "1 chilla with chutney", serveHi: "1 चीला, चटनी के साथ",
    why: "The breakfast dish, halved, for a hungry evening." },
  { id: "l-veg-soup-s", en: "Clear Vegetable Soup", hi: "सब्ज़ी का सूप", k: 110, p: 3,
    serve: "1 large bowl", serveHi: "1 बड़ा बाउल",
    why: "Warm and filling on almost nothing, before a late dinner." },
  { id: "l-fruit-raita", en: "Fruit Raita", hi: "फल रायता", k: 150, p: 7,
    serve: "1 katori", serveHi: "1 कटोरी",
    why: "Curd and fruit together, which most people never think to do." },
  { id: "l-moong-idli-s", en: "Steamed Moong Idli", hi: "मूंग इडली", k: 150, p: 8,
    serve: "3 small idli", serveHi: "3 छोटी इडली",
    why: "Steamed, so it stays light this close to dinner." },
  { id: "l-sweet-potato", en: "Steamed Sweet Potato Chaat", hi: "शकरकंद चाट", k: 160, p: 3,
    serve: "1 katori with lemon and chaat masala", serveHi: "1 कटोरी, नींबू और चाट मसाला",
    why: "Sweet, filling, and it never needed frying." },
  { id: "l-roasted-peanuts", en: "Roasted Peanuts", hi: "भुनी मूंगफली", k: 170, p: 7,
    serve: "1 small mutthi (25 g)", serveHi: "1 छोटी मुट्ठी (25 ग्राम)",
    why: "Cheapest protein in any Indian market — measure it, though." },
  { id: "l-nuts-date", en: "Almonds, Walnuts and a Date", hi: "बादाम, अखरोट और खजूर", k: 160, p: 5,
    serve: "6 almonds, 2 walnuts, 1 date", serveHi: "6 बादाम, 2 अखरोट, 1 खजूर",
    why: "Fats that are worth the calories, in a portion that stops." },
];

const DINNER: Dish[] = [
  { id: "l-khichdi-dinner", en: "Moong Dal Khichdi", hi: "मूंग दाल खिचड़ी", k: 400, p: 17,
    serve: "1 plate with a spoon of ghee", serveHi: "1 प्लेट, एक चम्मच घी",
    why: "The dinner you can eat at ten at night and still sleep." },
  { id: "l-palak-paneer-dinner", en: "Palak Paneer with One Roti", hi: "पालक पनीर", k: 400, p: 21,
    serve: "1 katori, 1 roti", serveHi: "1 कटोरी, 1 रोटी",
    why: "Protein at night is what actually repairs the day's training." },
  { id: "l-lauki-sabzi", en: "Lauki Sabzi with Roti", hi: "लौकी सब्ज़ी रोटी", k: 350, p: 11,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Almost all water — a full plate for very little." },
  { id: "l-dal-salad-dinner", en: "Dal with Salad and Roti", hi: "दाल, सलाद और रोटी", k: 360, p: 16,
    serve: "1 katori dal, big salad, 1 roti", serveHi: "1 कटोरी दाल, बड़ा सलाद, 1 रोटी",
    why: "Half the plate is salad, so the other half can be smaller." },
  { id: "l-paneer-tikka-dinner", en: "Paneer Tikka with Salad", hi: "पनीर टिक्का सलाद", k: 380, p: 26,
    serve: "8 cubes, big salad", serveHi: "8 टुकड़े, बड़ा सलाद",
    why: "The highest protein dinner here, and no grain at all." },
  { id: "l-veg-dalia-dinner", en: "Vegetable Dalia", hi: "सब्ज़ी दलिया", k: 350, p: 12,
    serve: "1 plate", serveHi: "1 प्लेट",
    why: "Broken wheat sits lighter at night than rice does." },
  { id: "l-missi-roti-curd", en: "Missi Roti with Curd", hi: "मिस्सी रोटी और दही", k: 400, p: 15,
    serve: "2 roti, 1 katori curd", serveHi: "2 रोटी, 1 कटोरी दही",
    why: "Gram flour in the dough turns a roti into a protein source." },
  { id: "l-idli-sambar-dinner", en: "Idli Sambar", hi: "इडली सांभर", k: 360, p: 12,
    serve: "3 idli, 1 bowl sambar", serveHi: "3 इडली, 1 कटोरी सांभर",
    why: "Fermented and steamed — the gentlest thing to end a day on." },
  { id: "l-tofu-bhurji-dinner", en: "Tofu Bhurji with Roti", hi: "टोफू भुर्जी रोटी", k: 420, p: 24,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Paneer's job, done with a third of the saturated fat." },
  { id: "l-soya-keema-dinner", en: "Soya Keema with Roti", hi: "सोया कीमा रोटी", k: 440, p: 26,
    serve: "1 katori, 2 roti", serveHi: "1 कटोरी, 2 रोटी",
    why: "Soya's protein score is the closest a plant gets to meat." },
  { id: "l-soup-roti", en: "Vegetable Soup with Roti", hi: "सब्ज़ी सूप और रोटी", k: 340, p: 10,
    serve: "1 large bowl, 2 roti", serveHi: "1 बड़ा बाउल, 2 रोटी",
    why: "The lightest dinner on the list, for the day after a feast." },
  { id: "l-thepla-dinner", en: "Methi Thepla with Curd", hi: "मेथी थेपला और दही", k: 380, p: 13,
    serve: "2 thepla, 1 katori curd", serveHi: "2 थेपला, 1 कटोरी दही",
    why: "Made in the morning; dinner needs only a plate." },
  { id: "l-chana-dinner", en: "Chana Masala with One Roti", hi: "छोले, एक रोटी", k: 390, p: 18,
    serve: "1 katori, 1 roti", serveHi: "1 कटोरी, 1 रोटी",
    why: "Fibre at night keeps the next morning honest." },
  { id: "l-bharta-bajra", en: "Baingan Bharta with Bajra Roti", hi: "बैंगन भरता, बाजरा रोटी", k: 350, p: 11,
    serve: "1 katori, 1 bajra roti", serveHi: "1 कटोरी, 1 बाजरा रोटी",
    why: "Pearl millet is warming — a winter dinner, properly." },
  { id: "l-rajma-dinner", en: "Rajma with Roti and Salad", hi: "राजमा, रोटी और सलाद", k: 400, p: 18,
    serve: "1 katori, 1 roti, salad", serveHi: "1 कटोरी, 1 रोटी, सलाद",
    why: "Lunch's rajma, without the rice under it." },
  { id: "l-paneer-bhurji-dinner", en: "Paneer Bhurji with One Roti", hi: "पनीर भुर्जी", k: 420, p: 24,
    serve: "1 katori, 1 roti", serveHi: "1 कटोरी, 1 रोटी",
    why: "Fastest high-protein dinner in the book." },
  { id: "l-mix-veg-jowar", en: "Mixed Vegetables with Jowar Roti", hi: "मिक्स वेज, जोवार रोटी", k: 370, p: 12,
    serve: "1 katori, 2 jowar roti", serveHi: "1 कटोरी, 2 जोवार रोटी",
    why: "Sorghum has no gluten and more iron than wheat." },
  { id: "l-curd-rice-dinner", en: "Curd Rice with Cucumber", hi: "दही चावल और खीरा", k: 350, p: 12,
    serve: "1 plate", serveHi: "1 प्लेट",
    why: "For a bad stomach, or a night too hot to cook." },
  { id: "l-dal-palak-rice", en: "Dal Palak with a Little Rice", hi: "दाल पालक, थोड़े चावल", k: 380, p: 16,
    serve: "1 katori dal, half katori rice", serveHi: "1 कटोरी दाल, आधी कटोरी चावल",
    why: "Spinach cooked into the dal, where nobody argues with it." },
  { id: "l-oats-khichdi", en: "Oats Vegetable Khichdi", hi: "ओट्स खिचड़ी", k: 350, p: 13,
    serve: "1 plate", serveHi: "1 प्लेट",
    why: "Khichdi's comfort with more fibre and fewer calories." },
  { id: "l-paneer-paratha-dinner", en: "Paneer Stuffed Roti with Curd", hi: "पनीर पराठा और दही", k: 430, p: 22,
    serve: "1 stuffed roti, 1 katori curd", serveHi: "1 भरवां रोटी, 1 कटोरी दही",
    why: "Cooked dry on a tawa, it is a high-protein dinner, not a treat." },
  { id: "l-warm-sprout-salad", en: "Warm Sprout and Vegetable Salad with Roti", hi: "अंकुरित सलाद और रोटी", k: 340, p: 17,
    serve: "1 large bowl, 1 roti", serveHi: "1 बड़ा बाउल, 1 रोटी",
    why: "Seventeen grams of protein for well under 400 calories." },
  { id: "l-kadhi-dinner", en: "Kadhi with a Small Bowl of Rice", hi: "कढ़ी और थोड़े चावल", k: 390, p: 12,
    serve: "1 katori kadhi, half katori rice", serveHi: "1 कटोरी कढ़ी, आधी कटोरी चावल",
    why: "Sour, warm, and lighter than the plate it looks like." },
];

export const POOLS: Record<SlotKey, Dish[]> = {
  breakfast: BREAKFAST, lunch: LUNCH, snack: SNACK, dinner: DINNER,
};

/** Every dish in the app, by id — the video pinner needs to resolve one. */
export const DISH_BY_ID: Record<string, Dish> = Object.fromEntries(
  Object.values(POOLS).flat().map((d) => [d.id, d])
);

/* ------------------------------------------------------------ the calendar walk */

export const OPTIONS_PER_SLOT = 3;

/**
 * How far each slot's window advances per day.
 *
 * Each must be coprime with its pool size, or the walk closes into a short
 * cycle and the same fortnight repeats forever; and each must be at least
 * OPTIONS_PER_SLOT, or consecutive days would share a dish. They differ between
 * slots so breakfast and dinner do not march in step — otherwise "the day I get
 * poha" would always also be "the day I get khichdi".
 */
const STRIDE: Record<SlotKey, number> = {
  breakfast: 3, lunch: 5, snack: 7, dinner: 4,
};

export const strideFor = (slot: SlotKey): number => STRIDE[slot];

/** The three dishes offered for one slot on one day. */
export function optionsFor(slot: SlotKey, day: number): Dish[] {
  const pool = POOLS[slot];
  const start = (day * STRIDE[slot]) % pool.length;
  return Array.from({ length: OPTIONS_PER_SLOT }, (_, i) => pool[(start + i) % pool.length]);
}

/** Which of the three is showing, honouring the person's pick if they made one. */
export const pickIndex = (picks: Record<string, number>, day: number, slot: SlotKey): number => {
  const v = picks[`${day}:${slot}`];
  return Number.isInteger(v) && v >= 0 && v < OPTIONS_PER_SLOT ? v : 0;
};

export interface DayMenu {
  day: number;
  date: Date;
  slots: { slot: Slot; options: Dish[]; chosen: Dish; index: number }[];
  k: number;
  p: number;
}

/** One day of the calendar, resolved against the person's picks. */
export function dayMenu(day: number, start: Date, picks: Record<string, number>): DayMenu {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day);
  const slots = SLOTS.map((slot) => {
    const options = optionsFor(slot.k, day);
    const index = pickIndex(picks, day, slot.k);
    return { slot, options, chosen: options[index], index };
  });
  return {
    day, date, slots,
    k: slots.reduce((s, x) => s + x.chosen.k, 0),
    p: slots.reduce((s, x) => s + x.chosen.p, 0),
  };
}

/** The whole month, for the calendar grid and for the validator. */
export function monthMenu(start: Date, picks: Record<string, number>): DayMenu[] {
  return Array.from({ length: MONTH_DAYS }, (_, d) => dayMenu(d, start, picks));
}

/** A cooking video search for a dish, built from its Hindi name. */
export const dishVideo = (d: Dish): string => youtubeSearchUrl(d.en, d.hi);

/* ------------------------------------------------------------------- the config */

export interface MenuConfig {
  /** "12:dinner" → 0 | 1 | 2 */
  picks: Record<string, number>;
  /** Local calendar day the month starts on, YYYY-MM-DD. */
  start: string;
}

export const EMPTY_MENU: MenuConfig = { picks: {}, start: "" };

/**
 * Sanitises a stored config. Runs on the server before a write and again in the
 * browser on read, because a config written by an older version of the app must
 * never be able to crash a calendar — an out-of-range pick silently becomes the
 * default rather than indexing off the end of an option list.
 */
export function cleanMenuConfig(raw: unknown): MenuConfig {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<MenuConfig>;
  const picks: Record<string, number> = {};
  const slots = new Set<string>(SLOTS.map((s) => s.k));
  for (const [key, v] of Object.entries(src.picks ?? {})) {
    const [dayRaw, slot] = String(key).split(":");
    const day = Number(dayRaw);
    const n = Math.trunc(Number(v));
    if (!Number.isInteger(day) || day < 0 || day >= MONTH_DAYS) continue;
    if (!slots.has(slot)) continue;
    if (!Number.isFinite(n) || n < 0 || n >= OPTIONS_PER_SLOT) continue;
    picks[`${day}:${slot}`] = n;
  }
  const start = typeof src.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(src.start) ? src.start : "";
  return { picks, start };
}

/** A week's worth of days, for the printable menu the cook works from. */
export const weekOf = (menu: DayMenu[], week: number): DayMenu[] =>
  menu.slice(week * 7, Math.min(week * 7 + 7, MONTH_DAYS));

export const WEEK_COUNT = Math.ceil(MONTH_DAYS / 7);

/** "Week 3", or "Days 29–30" for the tail that a 30-day month leaves over. */
export const weekLabel = (week: number): string => {
  const first = week * 7;
  const last = Math.min(first + 6, MONTH_DAYS - 1);
  return last - first === 6 ? `Week ${week + 1}` : `Days ${first + 1}–${last + 1}`;
};

/* -------------------------------------------------------- fitting the person */
/**
 * The plate is not one size.
 *
 * Every dish above is honest about the serving it names, and four of those
 * servings come to somewhere around 1,300 kcal. For a small, sedentary person
 * that is close to a maintenance day. For a 78 kg man who walks to work it is a
 * 900 kcal hole, and quietly serving him that under the banner of "lifestyle"
 * would be prescribing a crash diet to somebody who asked for lunch.
 *
 * So the menu is a base and this is the correction. The app already knows what
 * the person burns; the gap between that and the menu is closed with the things
 * an Indian kitchen already has out — another roti, a katori of dal, a glass of
 * milk. Nobody is asked to weigh any of it.
 *
 * The protein floor is 1.2 g per kg of bodyweight. The RDA is 0.8, but that is
 * the amount that prevents deficiency, not the amount that keeps muscle on a
 * middle-aged person, and vegetarian protein is less well absorbed besides.
 */
export interface Addon {
  /** Singular and plural, written out — "2 katori of dal" reads like a form. */
  one: string; many: string;
  /** Hindi takes the number in front and needs no plural form. */
  hi: string;
  k: number; p: number;
}

export const ADDONS: Addon[] = [
  { one: "a katori of dal",     many: "katori of dal",     hi: "कटोरी दाल",     k: 130, p: 8 },
  { one: "a katori of curd",    many: "katori of curd",    hi: "कटोरी दही",     k: 100, p: 6 },
  { one: "a glass of milk",     many: "glasses of milk",   hi: "गिलास दूध",     k: 160, p: 8 },
  { one: "another roti",        many: "more roti",         hi: "और रोटी",       k: 110, p: 3 },
  { one: "a katori of rice",    many: "katori of rice",    hi: "कटोरी चावल",    k: 140, p: 3 },
  { one: "a mutthi of peanuts", many: "mutthi of peanuts", hi: "मुट्ठी मूंगफली", k: 145, p: 6 },
  { one: "a banana",            many: "bananas",           hi: "केला",          k: 105, p: 1 },
  { one: "a spoon of ghee",     many: "spoons of ghee",    hi: "चम्मच घी",      k: 45,  p: 0 },
];

/** "a glass of milk" / "3 glasses of milk". */
export const addLabel = (a: Addon, n: number): string => (n === 1 ? a.one : `${n} ${a.many}`);
export const addLabelHi = (a: Addon, n: number): string => `${n} ${a.hi}`;

export type Verdict = "short" | "right" | "over";

export interface Fit {
  verdict: Verdict;
  /** kcal the menu is short of (positive) or over (negative). */
  gapK: number;
  gapP: number;
  /** What to add, in whole household servings. */
  adds: { addon: Addon; n: number }[];
  note: string;
}

/** A sedentary-adequate protein floor, not the deficiency-avoiding RDA. */
export const proteinFloor = (weightKg: number): number => Math.round(weightKg * 1.2);

/**
 * Closes the gap greedily, protein first. Protein-dense additions are tried
 * before the starches, because a day can be brought up to its calories with
 * rice alone and still be short of what it needs.
 */
export function fitToPerson(
  dayK: number, dayP: number, tdee: number, weightKg: number, seed = 0
): Fit {
  const targetP = proteinFloor(weightKg);
  let gapK = tdee - dayK;
  let gapP = targetP - dayP;

  if (gapK < -200) {
    return {
      verdict: "over", gapK, gapP, adds: [],
      note: `This day comes to about ${Math.abs(gapK)} kcal more than you burn. Take the lighter option at one of the meals, or leave the ghee off.`,
    };
  }
  if (gapK <= 200 && gapP <= 5) {
    return {
      verdict: "right", gapK, gapP, adds: [],
      note: "This day is about right for what you burn, and carries enough protein with it.",
    };
  }

  // Rank by how much of what is still missing each addition supplies, so a
  // protein shortfall pulls curd and dal forward and a pure calorie shortfall
  // pulls roti and rice forward.
  // Rotating the scan by the day means two additions that score equally are not
  // always resolved the same way, so a month of corrections is not a month of
  // the same three glasses of milk.
  const counts = new Map<Addon, number>();
  for (let step = 0; step < 12 && (gapK > 200 || gapP > 5); step++) {
    let best: Addon | null = null;
    let bestScore = 0;
    for (let i = 0; i < ADDONS.length; i++) {
      const a = ADDONS[i]!;
      // Two of anything is a portion; three is a diet of milk.
      if ((counts.get(a) ?? 0) >= 2) continue;
      if (a.k > gapK + 120) continue;                    // do not overshoot the day
      const raw = Math.min(a.p, Math.max(0, gapP)) * 4 + Math.min(a.k, Math.max(0, gapK)) * 0.35;
      // A small deterministic wobble, different for each day of the month. Two
      // additions that are within a few per cent of each other are genuinely
      // interchangeable, so which one wins should not be the same every single
      // day — otherwise a printed month reads "milk, peanuts" thirty times.
      const score = raw * (1 + (((i + seed) * 7) % 11) * 0.02);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    if (!best) break;
    counts.set(best, (counts.get(best) ?? 0) + 1);
    gapK -= best.k;
    gapP -= best.p;
  }

  const adds = [...counts.entries()].map(([addon, n]) => ({ addon, n }));
  const shortK = tdee - dayK;
  return {
    verdict: "short", gapK: shortK, gapP: targetP - dayP, adds,
    note: adds.length
      ? `On its own this day is about ${shortK} kcal lighter than you burn. Add the following and it lands where it should — no weighing, just more on the plate.`
      : `This day is about ${shortK} kcal lighter than you burn. Eat a little more of whatever is already on the plate.`,
  };
}
