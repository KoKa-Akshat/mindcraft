const desk = document.getElementById('desk');
const books = [...document.querySelectorAll('.book')];
const closeBook = document.getElementById('closeBook');
const title = document.getElementById('spreadTitle');
const kicker = document.getElementById('spreadKicker');
const body = document.getElementById('spreadBody');
const prompt = document.getElementById('spreadPrompt');
const instruction = document.getElementById('shelfInstruction');

function closeSpread() {
  desk.classList.remove('is-open');
  books.forEach(book => book.classList.remove('is-active'));
  instruction.textContent = 'Your desk, sorted into working pages.';
}

books.forEach(book => {
  book.addEventListener('click', () => {
    books.forEach(item => item.classList.toggle('is-active', item === book));
    kicker.textContent = book.dataset.kicker;
    title.textContent = book.dataset.title;
    body.textContent = book.dataset.body;
    prompt.textContent = book.dataset.prompt;
    desk.classList.add('is-open');
    instruction.textContent = `${book.dataset.title} is open.`;
  });
});

closeBook.addEventListener('click', closeSpread);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSpread();
});