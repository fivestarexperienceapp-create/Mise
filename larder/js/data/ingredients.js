// Ingredient database. Recipes reference these ids; diets, allergens, aisles,
// pack sizes and estimated prices are all derived from here.
//
// Row: [id, name (shopping list), one (singular, recipe lines), aisle, unit,
//       pack size (in unit), price per pack GBP, price per pack USD, flags,
//       perishable, cupboard staple, US name (optional)]
// Prices are typical mid-range supermarket estimates and are scaled per store.

export const AISLES = {
  produce: { uk: 'Fruit & veg', us: 'Produce' },
  meat: { uk: 'Meat & poultry', us: 'Meat' },
  fish: { uk: 'Fish & seafood', us: 'Seafood' },
  dairy: { uk: 'Dairy, eggs & chilled', us: 'Dairy, eggs & refrigerated' },
  bakery: { uk: 'Bread & bakery', us: 'Bakery' },
  grains: { uk: 'Pasta, rice & grains', us: 'Pasta, rice & grains' },
  tins: { uk: 'Tins, jars & stock', us: 'Canned goods & broth' },
  world: { uk: 'Sauces & world foods', us: 'Sauces & international' },
  spices: { uk: 'Herbs, spices & seasoning', us: 'Spices & seasonings' },
  baking: { uk: 'Oils, sugar & baking', us: 'Oils & baking' },
  frozen: { uk: 'Frozen', us: 'Frozen' },
  other: { uk: 'Other', us: 'Other' },
};

// Diet / allergen flags used below:
// meat poultry beef pork lamb fish crustacean mollusc dairy egg honey gluten
// nuts peanut sesame soy mustard celery sulphites
const P = true, N = false;
const ROWS = [
  // Meat & fish
  ['chicken-breast', 'Chicken breast fillets', 'chicken breast', 'meat', 'g', 600, 4.80, 7.50, ['meat', 'poultry'], P, N],
  ['chicken-thigh', 'Boneless chicken thighs', 'chicken thigh', 'meat', 'g', 500, 3.60, 5.50, ['meat', 'poultry'], P, N],
  ['beef-mince', 'Lean beef mince', 'lean beef mince', 'meat', 'g', 500, 4.25, 6.50, ['meat', 'beef'], P, N, 'Lean ground beef'],
  ['beef-strips', 'Beef stir-fry strips', 'beef stir-fry strips', 'meat', 'g', 350, 4.50, 7.50, ['meat', 'beef'], P, N, 'Beef sirloin strips'],
  ['pork-mince', 'Pork mince', 'pork mince', 'meat', 'g', 500, 3.25, 4.75, ['meat', 'pork'], P, N, 'Ground pork'],
  ['pork-loin', 'Pork loin steaks', 'pork loin', 'meat', 'g', 400, 3.50, 5.50, ['meat', 'pork'], P, N, 'Boneless pork loin chops'],
  ['pork-sausages', 'Pork sausages', 'pork sausage', 'meat', 'item', 8, 2.75, 5.00, ['meat', 'pork', 'gluten', 'sulphites'], P, N],
  ['lamb-mince', 'Lamb mince', 'lamb mince', 'meat', 'g', 500, 5.00, 8.00, ['meat', 'lamb'], P, N, 'Ground lamb'],
  ['turkey-mince', 'Turkey breast mince', 'turkey mince', 'meat', 'g', 500, 3.75, 5.50, ['meat', 'poultry'], P, N, 'Ground turkey'],
  ['chorizo', 'Cooking chorizo', 'chorizo', 'meat', 'g', 225, 2.50, 4.50, ['meat', 'pork'], N, N],
  ['salmon-fillet', 'Salmon fillets', 'salmon fillet', 'fish', 'item', 2, 4.25, 8.00, ['fish'], P, N],
  ['white-fish', 'White fish fillets (cod or hake)', 'white fish fillet', 'fish', 'g', 280, 4.00, 7.00, ['fish'], P, N],
  ['king-prawns', 'Raw king prawns', 'raw king prawns', 'fish', 'g', 225, 4.00, 6.50, ['crustacean'], P, N, 'Raw shrimp'],
  ['smoked-mackerel', 'Smoked mackerel fillets', 'smoked mackerel', 'fish', 'g', 200, 2.50, 6.00, ['fish'], P, N],
  ['tinned-tuna', 'Tinned tuna', 'tinned tuna', 'tins', 'g', 110, 1.25, 1.75, ['fish'], N, N, 'Canned tuna'],
  ['tofu', 'Firm tofu', 'firm tofu', 'dairy', 'g', 400, 2.00, 2.75, ['soy'], P, N],

  // Dairy & eggs
  ['egg', 'Free-range eggs', 'egg', 'dairy', 'item', 6, 2.10, 3.50, ['egg'], P, N],
  ['greek-yogurt', 'Greek-style yogurt', 'Greek-style yogurt', 'dairy', 'g', 500, 1.60, 4.50, ['dairy'], P, N],
  ['double-cream', 'Double cream', 'double cream', 'dairy', 'ml', 300, 1.45, 3.50, ['dairy'], P, N, 'Heavy cream'],
  ['soured-cream', 'Soured cream', 'soured cream', 'dairy', 'ml', 300, 1.10, 2.50, ['dairy'], P, N, 'Sour cream'],
  ['parmesan', 'Parmesan', 'Parmesan', 'dairy', 'g', 150, 2.75, 5.50, ['dairy'], N, N],
  ['cheddar', 'Mature cheddar', 'mature cheddar', 'dairy', 'g', 350, 3.20, 4.50, ['dairy'], N, N, 'Sharp cheddar'],
  ['mozzarella', 'Mozzarella', 'mozzarella', 'dairy', 'g', 125, 0.90, 3.50, ['dairy'], P, N],
  ['feta', 'Feta', 'feta', 'dairy', 'g', 200, 1.90, 4.50, ['dairy'], P, N],
  ['halloumi', 'Halloumi', 'halloumi', 'dairy', 'g', 225, 2.50, 6.00, ['dairy'], P, N],
  ['butter', 'Butter', 'butter', 'dairy', 'g', 250, 2.20, 4.50, ['dairy'], N, P],
  ['milk', 'Milk', 'milk', 'dairy', 'ml', 1136, 1.45, 2.00, ['dairy'], P, P],
  ['soya-milk', 'Unsweetened soya milk', 'unsweetened soya milk', 'dairy', 'ml', 1000, 1.50, 3.50, ['soy'], P, N, 'Unsweetened soy milk'],

  // Fruit & veg
  ['bell-pepper', 'Peppers', 'pepper', 'produce', 'item', 3, 1.40, 3.50, [], P, N, 'Bell peppers'],
  ['onion', 'Onions', 'onion', 'produce', 'item', 6, 1.00, 3.00, [], N, P, 'Yellow onions'],
  ['red-onion', 'Red onions', 'red onion', 'produce', 'item', 3, 0.85, 2.50, [], N, N],
  ['garlic', 'Garlic', 'garlic clove', 'produce', 'clove', 10, 0.35, 0.75, [], N, P],
  ['ginger', 'Fresh ginger', 'fresh ginger', 'produce', 'g', 100, 0.60, 1.20, [], N, N],
  ['lime', 'Limes', 'lime', 'produce', 'item', 4, 1.00, 2.00, [], P, N],
  ['lemon', 'Lemons', 'lemon', 'produce', 'item', 4, 1.00, 2.50, [], P, N],
  ['coriander', 'Fresh coriander', 'fresh coriander', 'produce', 'g', 30, 0.75, 1.00, [], P, N, 'Fresh cilantro'],
  ['parsley', 'Fresh flat-leaf parsley', 'fresh parsley', 'produce', 'g', 30, 0.75, 1.00, [], P, N],
  ['basil', 'Fresh basil', 'fresh basil', 'produce', 'g', 30, 0.85, 2.50, [], P, N],
  ['spinach', 'Baby spinach', 'baby spinach', 'produce', 'g', 240, 1.30, 3.50, [], P, N],
  ['broccoli', 'Broccoli', 'broccoli', 'produce', 'g', 350, 0.75, 2.00, [], P, N],
  ['green-beans', 'Green beans', 'green beans', 'produce', 'g', 200, 1.10, 2.50, [], P, N],
  ['carrot', 'Carrots', 'carrot', 'produce', 'item', 8, 0.60, 1.50, [], N, N],
  ['celery', 'Celery', 'celery stick', 'produce', 'stick', 8, 0.80, 2.00, ['celery'], P, N],
  ['potato', 'Potatoes', 'potatoes', 'produce', 'g', 2000, 1.50, 4.00, [], N, N, 'Russet potatoes'],
  ['new-potatoes', 'Baby new potatoes', 'baby new potatoes', 'produce', 'g', 750, 1.10, 3.50, [], N, N, 'Baby potatoes'],
  ['sweet-potato', 'Sweet potatoes', 'sweet potato', 'produce', 'g', 1000, 1.40, 3.00, [], N, N],
  ['butternut-squash', 'Butternut squash', 'butternut squash', 'produce', 'g', 900, 1.10, 3.00, [], N, N],
  ['cauliflower', 'Cauliflower', 'cauliflower', 'produce', 'g', 600, 1.00, 3.00, [], P, N],
  ['courgette', 'Courgettes', 'courgette', 'produce', 'item', 3, 1.10, 2.50, [], P, N, 'Zucchini'],
  ['mushrooms', 'Chestnut mushrooms', 'chestnut mushrooms', 'produce', 'g', 250, 1.10, 2.75, [], P, N, 'Cremini mushrooms'],
  ['cherry-tomatoes', 'Cherry tomatoes', 'cherry tomatoes', 'produce', 'g', 250, 1.00, 3.00, [], P, N],
  ['tomato', 'Tomatoes', 'tomato', 'produce', 'item', 6, 0.90, 3.00, [], P, N],
  ['cucumber', 'Cucumber', 'cucumber', 'produce', 'item', 1, 0.70, 1.00, [], P, N],
  ['avocado', 'Avocados', 'avocado', 'produce', 'item', 2, 1.50, 2.50, [], P, N],
  ['lettuce', 'Romaine lettuce', 'romaine lettuce', 'produce', 'g', 300, 1.00, 2.50, [], P, N],
  ['rocket', 'Rocket', 'rocket', 'produce', 'g', 80, 1.00, 3.50, [], P, N, 'Arugula'],
  ['red-cabbage', 'Red cabbage', 'red cabbage', 'produce', 'g', 800, 0.85, 2.50, [], N, N],
  ['spring-onion', 'Spring onions', 'spring onion', 'produce', 'item', 8, 0.60, 1.00, [], P, N, 'Green onions'],
  ['apple', 'Apples', 'apple', 'produce', 'item', 6, 1.60, 4.00, [], N, N],

  // Bakery
  ['tortilla', 'Tortilla wraps', 'tortilla wrap', 'bakery', 'item', 8, 1.35, 3.00, ['gluten'], N, N, 'Flour tortillas'],
  ['flatbread', 'Pittas or flatbreads', 'pitta or flatbread', 'bakery', 'item', 6, 0.95, 3.00, ['gluten'], N, N, 'Pita or flatbreads'],
  ['burger-bun', 'Burger buns', 'burger bun', 'bakery', 'item', 4, 1.00, 3.00, ['gluten', 'sesame'], P, N],
  ['crusty-bread', 'Crusty bread', 'crusty bread', 'bakery', 'g', 400, 1.20, 3.50, ['gluten'], P, N],
  ['breadcrumbs', 'Breadcrumbs', 'breadcrumbs', 'baking', 'g', 200, 1.00, 2.50, ['gluten'], N, N, 'Panko breadcrumbs'],

  // Pasta, rice & grains
  ['long-grain-rice', 'Long-grain rice', 'long-grain rice', 'grains', 'g', 1000, 1.10, 2.50, [], N, P],
  ['basmati-rice', 'Basmati rice', 'basmati rice', 'grains', 'g', 1000, 2.00, 4.00, [], N, P],
  ['arborio-rice', 'Risotto rice', 'risotto rice', 'grains', 'g', 500, 1.50, 3.50, [], N, N, 'Arborio rice'],
  ['spaghetti', 'Spaghetti', 'spaghetti', 'grains', 'g', 500, 0.75, 1.50, ['gluten'], N, P],
  ['penne', 'Penne pasta', 'penne', 'grains', 'g', 500, 0.75, 1.50, ['gluten'], N, P],
  ['egg-noodles', 'Medium egg noodles', 'egg noodles', 'grains', 'g', 300, 1.00, 2.50, ['gluten', 'egg'], N, N],
  ['rice-noodles', 'Rice noodles', 'rice noodles', 'grains', 'g', 300, 1.25, 2.75, [], N, N],
  ['couscous', 'Couscous', 'couscous', 'grains', 'g', 500, 1.00, 2.50, ['gluten'], N, N],
  ['gnocchi', 'Potato gnocchi', 'gnocchi', 'grains', 'g', 500, 1.10, 3.00, ['gluten'], N, N],
  ['red-lentils', 'Red split lentils', 'red lentils', 'grains', 'g', 500, 1.20, 2.00, [], N, N],

  // Tins, jars & stock
  ['chopped-tomatoes', 'Chopped tomatoes (400 g tin)', 'chopped tomatoes', 'tins', 'g', 400, 0.55, 1.25, [], N, P, 'Diced tomatoes (14 oz can)'],
  ['passata', 'Passata', 'passata', 'tins', 'ml', 500, 0.65, 2.50, [], N, N, 'Tomato passata (strained tomatoes)'],
  ['tomato-puree', 'Tomato purée', 'tomato purée', 'tins', 'tbsp', 13, 0.85, 1.25, [], N, P, 'Tomato paste'],
  ['kidney-beans', 'Kidney beans (tin)', 'drained kidney beans', 'tins', 'g', 240, 0.50, 1.10, [], N, N, 'Kidney beans (can)'],
  ['black-beans', 'Black beans (tin)', 'drained black beans', 'tins', 'g', 240, 0.75, 1.10, [], N, N, 'Black beans (can)'],
  ['chickpeas', 'Chickpeas (tin)', 'drained chickpeas', 'tins', 'g', 240, 0.60, 1.10, [], N, N, 'Chickpeas (can)'],
  ['butter-beans', 'Butter beans (tin)', 'drained butter beans', 'tins', 'g', 240, 0.60, 1.40, [], N, N, 'Butter / lima beans (can)'],
  ['cannellini-beans', 'Cannellini beans (tin)', 'drained cannellini beans', 'tins', 'g', 240, 0.60, 1.40, [], N, N, 'Cannellini beans (can)'],
  ['lentils-tin', 'Green lentils (tin)', 'drained green lentils', 'tins', 'g', 240, 0.80, 1.80, [], N, N, 'Lentils (can)'],
  ['coconut-milk', 'Coconut milk (tin)', 'coconut milk', 'tins', 'ml', 400, 1.00, 2.25, [], N, N, 'Coconut milk (can)'],
  ['sweetcorn', 'Sweetcorn (tin)', 'drained sweetcorn', 'tins', 'g', 200, 0.60, 1.10, [], N, N, 'Corn (can)'],
  ['sun-dried-tomatoes', 'Sun-dried tomatoes', 'sun-dried tomatoes', 'tins', 'g', 280, 2.00, 4.00, ['sulphites'], N, N],
  ['olives', 'Pitted Kalamata olives', 'Kalamata olives', 'tins', 'g', 180, 1.50, 3.50, [], N, N],
  ['chicken-stock', 'Chicken stock cubes', 'chicken stock', 'tins', 'ml', 4000, 1.00, 1.50, ['celery'], N, P, 'Chicken bouillon cubes'],
  ['beef-stock', 'Beef stock cubes', 'beef stock', 'tins', 'ml', 4000, 1.00, 1.50, ['celery'], N, P, 'Beef bouillon cubes'],
  ['vegetable-stock', 'Vegetable stock cubes', 'vegetable stock', 'tins', 'ml', 4000, 1.00, 1.50, ['celery'], N, P, 'Vegetable bouillon cubes'],

  // Sauces & world foods
  ['soy-sauce', 'Soy sauce', 'soy sauce', 'world', 'tbsp', 10, 1.20, 2.50, ['soy', 'gluten'], N, P],
  ['sesame-oil', 'Toasted sesame oil', 'toasted sesame oil', 'world', 'tsp', 30, 2.00, 3.50, ['sesame'], N, N],
  ['worcestershire', 'Worcestershire sauce', 'Worcestershire sauce', 'world', 'tsp', 30, 1.00, 2.75, ['fish'], N, N],
  ['dijon-mustard', 'Dijon mustard', 'Dijon mustard', 'world', 'tsp', 36, 1.10, 2.75, ['mustard'], N, P],
  ['mayonnaise', 'Mayonnaise', 'mayonnaise', 'world', 'tbsp', 27, 1.75, 3.50, ['egg', 'mustard'], N, P],
  ['green-pesto', 'Green pesto', 'green pesto', 'world', 'tbsp', 12, 1.75, 3.50, ['dairy', 'nuts'], N, N, 'Basil pesto'],
  ['thai-curry-paste', 'Thai green curry paste', 'Thai green curry paste', 'world', 'tbsp', 6, 1.75, 3.50, ['crustacean', 'fish'], N, N],
  ['tikka-paste', 'Tikka curry paste', 'tikka curry paste', 'world', 'tbsp', 10, 1.75, 3.50, ['mustard'], N, N],
  ['sweet-chilli-sauce', 'Sweet chilli sauce', 'sweet chilli sauce', 'world', 'tbsp', 18, 1.20, 2.75, [], N, N, 'Sweet chili sauce'],
  ['peanut-butter', 'Smooth peanut butter', 'peanut butter', 'world', 'tbsp', 22, 1.80, 3.00, ['peanut'], N, P],
  ['caesar-dressing', 'Caesar dressing', 'Caesar dressing', 'world', 'tbsp', 16, 1.75, 3.50, ['egg', 'fish', 'dairy', 'mustard'], N, N],

  // Oils, sugar & baking
  ['olive-oil', 'Olive oil', 'olive oil', 'baking', 'tbsp', 33, 4.50, 8.00, [], N, P],
  ['vegetable-oil', 'Vegetable oil', 'vegetable oil', 'baking', 'tbsp', 66, 2.00, 3.50, [], N, P],
  ['honey', 'Runny honey', 'runny honey', 'baking', 'tbsp', 22, 1.60, 4.50, ['honey'], N, P],
  ['brown-sugar', 'Soft brown sugar', 'soft brown sugar', 'baking', 'tsp', 100, 1.20, 2.25, [], N, P, 'Light brown sugar'],
  ['cornflour', 'Cornflour', 'cornflour', 'baking', 'tsp', 80, 0.90, 2.00, [], N, P, 'Cornstarch'],

  // Herbs, spices & seasoning
  ['fajita-seasoning', 'Fajita seasoning', 'fajita seasoning', 'spices', 'tsp', 12, 0.85, 1.50, [], N, N],
  ['smoked-paprika', 'Smoked paprika', 'smoked paprika', 'spices', 'tsp', 20, 1.20, 3.50, [], N, P],
  ['cumin', 'Ground cumin', 'ground cumin', 'spices', 'tsp', 20, 1.10, 3.50, [], N, P],
  ['chilli-powder', 'Mild chilli powder', 'mild chilli powder', 'spices', 'tsp', 20, 1.10, 3.50, [], N, P, 'Chili powder'],
  ['curry-powder', 'Medium curry powder', 'medium curry powder', 'spices', 'tsp', 30, 1.20, 3.50, [], N, P],
  ['turmeric', 'Ground turmeric', 'ground turmeric', 'spices', 'tsp', 20, 1.10, 3.50, [], N, P],
  ['mixed-herbs', 'Dried mixed herbs', 'dried mixed herbs', 'spices', 'tsp', 30, 0.95, 2.50, [], N, P, 'Italian seasoning'],
  ['dried-oregano', 'Dried oregano', 'dried oregano', 'spices', 'tsp', 30, 0.95, 2.50, [], N, P],
  ['dried-mint', 'Dried mint', 'dried mint', 'spices', 'tsp', 30, 1.00, 3.00, [], N, N],
  ['chilli-flakes', 'Chilli flakes', 'chilli flakes', 'spices', 'tsp', 40, 1.10, 3.00, [], N, P, 'Red pepper flakes'],
  ['sesame-seeds', 'Sesame seeds', 'sesame seeds', 'spices', 'tsp', 30, 1.00, 2.75, ['sesame'], N, N],

  // Frozen
  ['peas', 'Frozen peas', 'frozen peas', 'frozen', 'g', 900, 1.20, 2.75, [], N, P],
];

export const INGREDIENTS = Object.fromEntries(ROWS.map(([id, name, one, aisle, unit, pack, gbp, usd, flags, perishable, staple, usName]) => [
  id,
  { id, name, one, aisle, unit, pack, price: { gbp, usd }, flags, perishable, staple, usName: usName || null },
]));

export const ingredientName = (ing, region) => (region === 'us' && ing.usName ? ing.usName : ing.name);

// Words for diets, allergens and kitchen kit.
export const DIETS = [
  { id: 'vegetarian', label: 'Vegetarian', blocks: ['meat', 'fish', 'crustacean', 'mollusc'] },
  { id: 'vegan', label: 'Vegan', blocks: ['meat', 'fish', 'crustacean', 'mollusc', 'dairy', 'egg', 'honey'] },
  { id: 'pescatarian', label: 'Pescatarian', blocks: ['meat'] },
  { id: 'gluten-free', label: 'Gluten-free', blocks: ['gluten'] },
  { id: 'dairy-free', label: 'Dairy-free', blocks: ['dairy'] },
  { id: 'no-pork', label: 'No pork', blocks: ['pork'] },
  { id: 'no-red-meat', label: 'No red meat', blocks: ['beef', 'lamb', 'pork'] },
  { id: 'low-carb', label: 'Lower carb', maxCarbs: 35 },
];

export const ALLERGENS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'dairy', label: 'Milk' },
  { id: 'egg', label: 'Eggs' },
  { id: 'fish', label: 'Fish' },
  { id: 'crustacean', label: 'Crustaceans' },
  { id: 'mollusc', label: 'Molluscs' },
  { id: 'nuts', label: 'Tree nuts' },
  { id: 'peanut', label: 'Peanuts' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'soy', label: 'Soya' },
  { id: 'mustard', label: 'Mustard' },
  { id: 'celery', label: 'Celery' },
  { id: 'sulphites', label: 'Sulphites' },
];

export const EQUIPMENT = [
  { id: 'hob', label: 'Hob', us: 'Stovetop' },
  { id: 'oven', label: 'Oven' },
  { id: 'airfryer', label: 'Air fryer' },
  { id: 'microwave', label: 'Microwave' },
  { id: 'slowcooker', label: 'Slow cooker' },
  { id: 'grill', label: 'Grill', us: 'Broiler / grill' },
];

export const VIBES = [
  { id: 'quick', label: 'Quick', emoji: '⏱️', hint: '30 minutes or less' },
  { id: 'lowcal', label: 'Lighter', emoji: '🥗', hint: 'Under 500 kcal' },
  { id: 'protein', label: 'High protein', emoji: '💪', hint: '35 g+ protein' },
  { id: 'family', label: 'Family favourites', emoji: '👨‍👩‍👧', hint: 'Crowd-pleasers' },
  { id: 'comfort', label: 'Comfort food', emoji: '🍲', hint: 'Cosy and hearty' },
  { id: 'takeaway', label: 'Takeaway nights', emoji: '🥡', hint: 'Better than delivery' },
  { id: 'fibre', label: 'High fibre', emoji: '🌱', hint: '10 g+ fibre' },
  { id: 'classics', label: 'Classics', emoji: '🥧', hint: 'Old reliables' },
];
