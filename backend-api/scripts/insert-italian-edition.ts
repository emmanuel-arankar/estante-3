import { admin, db } from '../src/firebase';

const editionData = {
  asin: "8202405440",
  contributors: [
    {
      name: "Koushun Takami",
      personId: "person_koushun_takami",
      photoUrl: "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRuWRIYm5b_4OxcYfD1RtKK6iirvhzl7kbJk0VyLBTbce8UJFRP",
      role: "author"
    },
    {
      name: "Yngve Johan Larsen",
      personId: "",
      photoUrl: "",
      role: "translator"
    }
  ],
  coverUrl: "https://www.akademika.no/sites/default/files/styles/product_large/public/product_images/978/8/2/0/2/4/0/9788202405441.jpg?itok=XU4FL4fu",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  description: "<p><b>Battle Royale</b> handler om 42 utvalgte elever fra klasse 3B på Shiroiwa ungdomsskole. Et likt antall jenter og gutter fraktes til en øde øy, utstyres med eksplosive halsbånd, et minimum av matrasjoner og hvert sitt tilfeldige våpen.</p> <p><b>Oppgaven er enkel:</b> De skal drepe hverandre inntil det står én vinner tilbake.</p> <p>Dersom det går mer enn tjuefire timer uten at noen drepes, detoneres halslenkene og alle dør.</p>",
  dimensions: {
    height: 18.5,
    width: 11.5,
    thickness: 3.5
  },
  editionNumber: "1",
  formatCategoryId: "physical",
  formatId: "paperback",
  imprint: {
    id: "",
    name: ""
  },
  isbn10: "8202405440",
  isbn13: "9788202405441",
  language: "no",
  pages: 607,
  publicationDate: "2013-06-17",
  publisher: {
    id: "",
    name: "Cappelen Damm"
  },
  searchTerms: [],
  stats: {
    averageRating: 0,
    ratingsCount: 0,
    reviewsCount: 0
  },
  title: "Battle Royale",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  weight: 376,
  workId: "work_battle_royale"
};

async function run() {
  try {
    const docRef = await db.collection('editions').add(editionData);
    console.log('Edição inserida com sucesso! ID:', docRef.id);
    process.exit(0);
  } catch (error) {
    console.error('Erro ao inserir edição:', error);
    process.exit(1);
  }
}

run();