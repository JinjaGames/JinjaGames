// Rastgele oyuncu adı: iki kelimelik, komik ama kimseye hakaret etmeyen İngilizce isimler ("Sneaky Potato").
const A = ["Sneaky", "Sleepy", "Grumpy", "Fluffy", "Wobbly", "Spicy", "Crunchy", "Soggy", "Bouncy", "Cheeky", "Clumsy", "Dizzy", "Fancy", "Funky", "Giggly",
  "Goofy", "Grumbly", "Hasty", "Hungry", "Jolly", "Jumpy", "Lazy", "Loud", "Lucky", "Mighty", "Moody", "Nervous", "Nifty", "Noisy", "Peppy", "Perky",
  "Plucky", "Quirky", "Rowdy", "Rusty", "Salty", "Sassy", "Silly", "Sloppy", "Snappy", "Sparkly", "Speedy", "Squeaky", "Sticky", "Stinky", "Sunny",
  "Tiny", "Tipsy", "Turbo", "Wacky", "Wiggly", "Witty", "Zesty", "Zippy", "Chunky", "Cosmic", "Crispy", "Dapper", "Dramatic", "Electric", "Fearless",
  "Feisty", "Fuzzy", "Gloomy", "Groovy", "Hairy", "Humble", "Itchy", "Jazzy", "Lumpy", "Majestic", "Mellow", "Mischievous", "Mysterious", "Nimble",
  "Overcooked", "Pancake", "Polite", "Puffy", "Radical", "Rubbery", "Scrappy", "Shiny", "Shy", "Slippery", "Smelly", "Sneezy", "Snoozy", "Soft",
  "Spooky", "Squishy", "Stubborn", "Suspicious", "Swift", "Ticklish", "Toasty", "Tropical", "Unbothered", "Velvet", "Wandering", "Wise", "Yawning",
  "Zany", "Brave", "Bubbly", "Caffeinated", "Chilly", "Confused", "Curious", "Dancing", "Dusty", "Epic", "Frosty", "Glittery", "Hiccuping", "Invisible"];
const B = ["Potato", "Cow", "Pickle", "Noodle", "Waffle", "Penguin", "Llama", "Goose", "Taco", "Muffin", "Badger", "Walrus", "Burrito", "Cactus",
  "Dumpling", "Ferret", "Giraffe", "Hamster", "Iguana", "Jellyfish", "Kiwi", "Lobster", "Meatball", "Narwhal", "Octopus", "Pancake", "Panda", "Pigeon",
  "Platypus", "Pretzel", "Pudding", "Raccoon", "Sandwich", "Sloth", "Snail", "Sock", "Spoon", "Squid", "Toaster", "Turnip", "Unicorn", "Walnut",
  "Wombat", "Yak", "Zucchini", "Alpaca", "Avocado", "Bagel", "Banana", "Beetle", "Biscuit", "Blob", "Broccoli", "Bubble", "Burger", "Cabbage",
  "Camel", "Carrot", "Chicken", "Chipmunk", "Cookie", "Crab", "Croissant", "Cupcake", "Donut", "Duck", "Eggplant", "Flamingo", "Frog", "Gnome",
  "Goat", "Gorilla", "Hedgehog", "Hippo", "Jellybean", "Kebab", "Koala", "Lemon", "Marshmallow", "Meerkat", "Moose", "Mushroom", "Nugget", "Otter",
  "Owl", "Parrot", "Peach", "Peanut", "Pebble", "Pineapple", "Pizza", "Popcorn", "Possum", "Puffin", "Pumpkin", "Quokka", "Radish", "Robot",
  "Sausage", "Seagull", "Shrimp", "Simit", "Sprout", "Sushi", "Teapot", "Tofu", "Tomato", "Turtle", "Viking", "Wizard", "Yeti", "Zebra", "Baklava",
  "Dolphin", "Kitten", "Lettuce", "Mango", "Pirate", "Puppy", "Rocket", "Tortilla", "Trumpet", "Velociraptor", "Volcano"];
const pick = (l) => l[(crypto.getRandomValues(new Uint32Array(1))[0]) % l.length];
export function randomName() {
  let a = pick(A), b = pick(B);
  while (a === b) b = pick(B);
  const n = `${a} ${b}`;
  return n.length <= 20 ? n : randomName();
}
export const NAME_COUNT = A.length * B.length;
