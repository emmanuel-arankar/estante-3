import { admin, db } from '../src/firebase';

const editionData = {
  asin: "6155676119",
  contributors: [
    {
      name: "Koushun Takami",
      personId: "person_koushun_takami",
      photoUrl: "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRuWRIYm5b_4OxcYfD1RtKK6iirvhzl7kbJk0VyLBTbce8UJFRP",
      role: "author"
    },
    {
      name: "Mayer Ingrid",
      personId: "",
      photoUrl: "",
      role: "translator"
    }
  ],
  coverUrl: "",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  description: "<p>Valahol, valamikor egy diktatórikus távol-keleti országban az állami vezetők kegyetlen kísérletet eszelnek ki.</p> <p><b>Negyvenkét középiskolást egy lakatlan szigetre visznek</b>, ahol arra kényszerítik őket, hogy életre-halálra megvívjanak egymással.</p> <p>Géppisztolytól kezdve a sarlón át a konyhai étkészletből származó villáig bármilyen fegyver a rendelkezésükre áll.</p> <p><b>A Programnak csak egyetlen túlélője lehet: a győztes.</b></p> <p>Takami Kósun regénye – amelyet gyakran a 21. századi <i>Legyek ura</i>-ként emlegetnek – botrányos karriert futott be, és 1999 óta világszerte bestseller lett, számos feldolgozással.</p>",
  dimensions: {
    height: 20,
    width: 13,
    thickness: null
  },
  editionNumber: "1",
  formatCategoryId: "physical",
  formatId: "paperback",
  imprint: {
    id: "",
    name: ""
  },
  isbn10: "6155676119",
  isbn13: "9786155676116",
  language: "hu",
  pages: 752,
  publicationDate: "2016-12-12",
  publisher: {
    id: "",
    name: "Művelt Nép Könyvkiadó"
  },
  publisherName: "Művelt Nép Könyvkiadó",
  searchTerms: [
  ],
  stats: {
    averageRating: 0.0,
    ratingsCount: 0,
    reviewsCount: 0
  },
  title: "Battle Royale",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  weight: 530,
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