# The Mayor

A turn-based city economics strategy game. You run a fictional city for **10 years (40 quarters)**, setting taxes, budgets and big projects. Your choices drive the treasury, population, GDP, unemployment and happiness. Random events keep you on your toes, and you get a score out of 1000 at the end.

## How to run

Double-click `index.html`. That's it: no installs and no build step.

- Charts and the Inter font load from the internet. Without a connection the game still works, but charts are replaced by a short message.
- Your game **saves automatically** in the browser's `localStorage` after every quarter, and when you move a slider. Close the tab, come back later, and you continue where you left off. Saves belong to that browser on that computer.

## How to play

1. **Budget tab:** set income, business and sales taxes, plus spending on each city service. The panel on the right shows next quarter's forecast as you drag.
2. **Projects tab:** build one-time investments (transit, hospital, tech hub...). They are paid up front and help every quarter once they open.
3. Press **End Quarter** (or the Space key). Watch the news feed, respond to events, and read the annual report each year.
4. **Avoid losing early:**
   - If debt reaches 3× yearly revenue, the city goes **bankrupt**.
   - If happiness stays below 20 for 3 quarters, voters **recall** you.

**Scoring:** GDP growth 25%, average happiness 25%, fiscal health 20%, population growth 15%, unemployment 15%. Grades go from S down to F.

## Project layout

```
index.html          The single page (loads everything in order)
css/
  tokens.css        Colors, fonts, light and dark themes
  layout.css        Page structure and responsive breakpoints
  components.css    Buttons, cards, sliders, modals...
js/
  config.js         ALL tuning numbers: change these to rebalance the game
  util.js           Formatting helpers ($1.2M, 5.3%...)
  random.js         Seeded random numbers, so saves replay exactly
  state.js          Creates a new game state
  economy.js        The economic simulation (one quarter at a time)
  projects.js       Project catalog and construction
  events.js         Random event deck
  scoring.js        Final score and grade
  storage.js        Saving and loading (localStorage)
  game.js           Turn flow and advisor tips
  ui/               Everything that draws on the page
  main.js           Starts the app and wires up buttons
tests/
  test.html         Open in a browser to run the engine tests
  simulate.html     Plays hundreds of games with scripted strategies to check balance
  strategies.js     The scripted strategies used by the simulator
```

**Rule of thumb:** files in `js/` (outside `js/ui/`) never touch the page. They only do math on the state object, which keeps them easy to test.

## How one quarter is calculated

`economy.simulateQuarter` runs these steps in order:

1. **Revenue:**
   - income tax on wages (60% of GDP × employment)
   - business tax on profits (20% of GDP)
   - sales tax on consumption (45% of GDP)
2. **Spending:** service budgets + unemployment benefits + project upkeep + debt interest. If the treasury runs out, the city borrows the difference.
3. **Services:** quality drifts 25% of the way each quarter toward `100 × (1 − e^(−spending per resident / k))`. This gives diminishing returns.
4. **Business climate:** helped by infrastructure, education and safety, and hurt by business tax.
5. **GDP growth:** 0.5% base, plus climate and education effects, minus a high-tax drag, plus events and a little randomness.
6. **Population:** grows with happiness and job availability.
7. **Unemployment:** jobs (GDP ÷ productivity) compared with the labor force.
8. **Happiness:** services, minus unemployment and tax burden, plus events. It is smoothed over time.

## Tweaking the game

Edit numbers in `js/config.js`, then open `tests/simulate.html` to check the balance. A healthy result looks like this:

- Sensible play averages an A or B.
- Doing nothing averages about a C.
- Extreme strategies (max taxes, zero taxes, max spending, austerity) lose.

The current numbers give:

| Strategy | Average score | Lost |
|---|---|---|
| Balanced | 792 (A) | 0% |
| Do nothing | 503 (C) | under 1% |
| Every extreme strategy | under 60 | 100% |
