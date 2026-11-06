// Supermarkets: a price index (1.00 = typical mid-range) and a typical aisle
// walk order. Both are approximations to make estimates and lists useful;
// edit them freely for your local stores.

const PRODUCE_FIRST = ['produce', 'bakery', 'meat', 'fish', 'dairy', 'grains', 'tins', 'world', 'spices', 'baking', 'frozen', 'other'];
const DISCOUNTER = ['produce', 'bakery', 'dairy', 'meat', 'fish', 'grains', 'tins', 'world', 'baking', 'spices', 'frozen', 'other'];
const PERIMETER = ['produce', 'bakery', 'meat', 'fish', 'dairy', 'frozen', 'grains', 'tins', 'world', 'baking', 'spices', 'other'];

export const REGIONS = {
  uk: { id: 'uk', label: 'United Kingdom', currency: 'GBP', symbol: '£', locale: 'en-GB' },
  us: { id: 'us', label: 'United States', currency: 'USD', symbol: '$', locale: 'en-US' },
};

export const STORES = {
  uk: [
    { id: 'tesco', name: 'Tesco', index: 1.0, order: PRODUCE_FIRST },
    { id: 'sainsburys', name: "Sainsbury's", index: 1.04, order: PRODUCE_FIRST },
    { id: 'asda', name: 'Asda', index: 0.95, order: PRODUCE_FIRST },
    { id: 'morrisons', name: 'Morrisons', index: 1.0, order: PRODUCE_FIRST },
    { id: 'aldi-uk', name: 'Aldi', index: 0.86, order: DISCOUNTER },
    { id: 'lidl-uk', name: 'Lidl', index: 0.86, order: DISCOUNTER },
    { id: 'coop', name: 'Co-op', index: 1.12, order: PRODUCE_FIRST },
    { id: 'waitrose', name: 'Waitrose', index: 1.22, order: PRODUCE_FIRST },
    { id: 'mands', name: 'M&S Food', index: 1.3, order: PRODUCE_FIRST },
    { id: 'ocado', name: 'Ocado', index: 1.1, order: PRODUCE_FIRST },
    { id: 'iceland', name: 'Iceland', index: 0.97, order: PERIMETER },
  ],
  us: [
    { id: 'walmart', name: 'Walmart', index: 0.88, order: PERIMETER },
    { id: 'kroger', name: 'Kroger', index: 1.0, order: PERIMETER },
    { id: 'aldi-us', name: 'Aldi', index: 0.82, order: DISCOUNTER },
    { id: 'costco', name: 'Costco', index: 0.85, order: PERIMETER },
    { id: 'target', name: 'Target', index: 0.98, order: PERIMETER },
    { id: 'traderjoes', name: "Trader Joe's", index: 0.95, order: PERIMETER },
    { id: 'safeway', name: 'Safeway', index: 1.12, order: PERIMETER },
    { id: 'publix', name: 'Publix', index: 1.1, order: PERIMETER },
    { id: 'heb', name: 'H-E-B', index: 0.92, order: PERIMETER },
    { id: 'wholefoods', name: 'Whole Foods Market', index: 1.28, order: PERIMETER },
  ],
};

export function storeFor(region, id) {
  const list = STORES[region] || STORES.uk;
  return list.find((s) => s.id === id) || list[0];
}
