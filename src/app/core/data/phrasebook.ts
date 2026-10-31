export const PHRASE_KEYS = ['Hello', 'Thank you', 'Please', 'Sorry / excuse me', 'Yes', 'No', 'How much is it?', 'Where is the toilet?', 'The bill, please', 'Help!', 'Goodbye'] as const;

type Phrase = [string, string?];
export interface PhraseSet {
  native: string;
  phrases: Phrase[];
  note?: string;
}

export const PHRASEBOOK: Record<string, PhraseSet> = {
  Spanish: { native: 'Español', phrases: [['Hola'], ['Gracias'], ['Por favor'], ['Perdón'], ['Sí'], ['No'], ['¿Cuánto cuesta?'], ['¿Dónde está el baño?'], ['La cuenta, por favor'], ['¡Ayuda!'], ['Adiós']] },
  French: { native: 'Français', phrases: [['Bonjour'], ['Merci'], ["S'il vous plaît"], ['Pardon'], ['Oui'], ['Non'], ["C'est combien ?"], ['Où sont les toilettes ?'], ["L'addition, s'il vous plaît"], ['Au secours !'], ['Au revoir']] },
  Portuguese: { native: 'Português', phrases: [['Olá'], ['Obrigado (m) / Obrigada (f)'], ['Por favor'], ['Desculpe'], ['Sim'], ['Não'], ['Quanto custa?'], ['Onde fica a casa de banho? (PT) · Onde fica o banheiro? (BR)'], ['A conta, por favor'], ['Socorro!'], ['Adeus · Tchau']] },
  German: { native: 'Deutsch', phrases: [['Hallo · Guten Tag'], ['Danke'], ['Bitte'], ['Entschuldigung'], ['Ja'], ['Nein'], ['Was kostet das?'], ['Wo ist die Toilette?'], ['Die Rechnung, bitte'], ['Hilfe!'], ['Auf Wiedersehen · Tschüss']] },
  Italian: { native: 'Italiano', phrases: [['Buongiorno · Ciao'], ['Grazie'], ['Per favore'], ['Mi scusi'], ['Sì'], ['No'], ['Quanto costa?'], ["Dov'è il bagno?"], ['Il conto, per favore'], ['Aiuto!'], ['Arrivederci']] },
  Dutch: { native: 'Nederlands', phrases: [['Hallo · Goedendag'], ['Dank u wel'], ['Alstublieft'], ['Sorry · Pardon'], ['Ja'], ['Nee'], ['Hoeveel kost het?'], ['Waar is het toilet?'], ['De rekening, alstublieft'], ['Help!'], ['Tot ziens']] },
  Romanian: { native: 'Română', phrases: [['Bună ziua'], ['Mulțumesc'], ['Vă rog'], ['Scuzați-mă'], ['Da'], ['Nu'], ['Cât costă?'], ['Unde este toaleta?'], ['Nota, vă rog'], ['Ajutor!'], ['La revedere']] },
  Catalan: { native: 'Català', phrases: [['Hola'], ['Gràcies'], ['Si us plau'], ['Perdó'], ['Sí'], ['No'], ['Quant costa?'], ['On és el lavabo?'], ['El compte, si us plau'], ['Ajuda!'], ['Adéu']] },
  Greek: { native: 'Ελληνικά', phrases: [['Γειά σας', 'Yiá sas'], ['Ευχαριστώ', 'Efcharistó'], ['Παρακαλώ', 'Parakaló'], ['Συγγνώμη', 'Signómi'], ['Ναι', 'Ne'], ['Όχι', 'Óchi'], ['Πόσο κάνει;', 'Póso kánei?'], ['Πού είναι η τουαλέτα;', 'Poú íne i toualéta?'], ['Τον λογαριασμό, παρακαλώ', 'Ton logariasmó, parakaló'], ['Βοήθεια!', 'Voítheia!'], ['Αντίο', 'Adío']] },
  Turkish: { native: 'Türkçe', phrases: [['Merhaba'], ['Teşekkür ederim'], ['Lütfen'], ['Affedersiniz'], ['Evet'], ['Hayır'], ['Ne kadar?'], ['Tuvalet nerede?'], ['Hesap, lütfen'], ['İmdat!'], ['Hoşça kalın']] },
  Polish: { native: 'Polski', phrases: [['Dzień dobry'], ['Dziękuję'], ['Proszę'], ['Przepraszam'], ['Tak'], ['Nie'], ['Ile to kosztuje?'], ['Gdzie jest toaleta?'], ['Poproszę rachunek'], ['Pomocy!'], ['Do widzenia']] },
  Czech: { native: 'Čeština', phrases: [['Dobrý den'], ['Děkuji'], ['Prosím'], ['Promiňte'], ['Ano'], ['Ne'], ['Kolik to stojí?'], ['Kde je toaleta?'], ['Zaplatím, prosím'], ['Pomoc!'], ['Na shledanou']] },
  Slovak: { native: 'Slovenčina', phrases: [['Dobrý deň'], ['Ďakujem'], ['Prosím'], ['Prepáčte'], ['Áno'], ['Nie'], ['Koľko to stojí?'], ['Kde je toaleta?'], ['Zaplatím, prosím'], ['Pomoc!'], ['Dovidenia']] },
  Hungarian: { native: 'Magyar', phrases: [['Jó napot'], ['Köszönöm'], ['Kérem'], ['Elnézést'], ['Igen'], ['Nem'], ['Mennyibe kerül?'], ['Hol van a mosdó?'], ['A számlát, kérem'], ['Segítség!'], ['Viszontlátásra']] },
  Croatian: { native: 'Hrvatski', phrases: [['Dobar dan'], ['Hvala'], ['Molim'], ['Oprostite'], ['Da'], ['Ne'], ['Koliko košta?'], ['Gdje je WC?'], ['Račun, molim'], ['Upomoć!'], ['Doviđenja']] },
  Serbian: { native: 'Српски', phrases: [['Добар дан', 'Dobar dan'], ['Хвала', 'Hvala'], ['Молим', 'Molim'], ['Извините', 'Izvinite'], ['Да', 'Da'], ['Не', 'Ne'], ['Колико кошта?', 'Koliko košta?'], ['Где је тоалет?', 'Gde je toalet?'], ['Рачун, молим', 'Račun, molim'], ['Упомоћ!', 'Upomoć!'], ['Довиђења', 'Doviđenja']] },
  Bulgarian: { native: 'Български', phrases: [['Здравейте', 'Zdraveyte'], ['Благодаря', 'Blagodarya'], ['Моля', 'Molya'], ['Извинете', 'Izvinete'], ['Да', 'Da'], ['Не', 'Ne'], ['Колко струва?', 'Kolko struva?'], ['Къде е тоалетната?', 'Kade e toaletnata?'], ['Сметката, моля', 'Smetkata, molya'], ['Помощ!', 'Pomosht!'], ['Довиждане', 'Dovizhdane']] },
  Swedish: { native: 'Svenska', phrases: [['Hej'], ['Tack'], ['Snälla'], ['Ursäkta'], ['Ja'], ['Nej'], ['Vad kostar det?'], ['Var är toaletten?'], ['Notan, tack'], ['Hjälp!'], ['Hej då']] },
  Danish: { native: 'Dansk', phrases: [['Hej'], ['Tak'], ['Vær så venlig'], ['Undskyld'], ['Ja'], ['Nej'], ['Hvad koster det?'], ['Hvor er toilettet?'], ['Regningen, tak'], ['Hjælp!'], ['Farvel']] },
  Norwegian: { native: 'Norsk', phrases: [['Hei'], ['Takk'], ['Vær så snill'], ['Unnskyld'], ['Ja'], ['Nei'], ['Hva koster det?'], ['Hvor er toalettet?'], ['Regningen, takk'], ['Hjelp!'], ['Ha det']] },
  Finnish: { native: 'Suomi', phrases: [['Hei · Päivää'], ['Kiitos'], ['Ole hyvä'], ['Anteeksi'], ['Kyllä'], ['Ei'], ['Paljonko se maksaa?'], ['Missä on vessa?'], ['Lasku, kiitos'], ['Apua!'], ['Näkemiin']] },
  Russian: { native: 'Русский', phrases: [['Здравствуйте', 'Zdravstvuyte'], ['Спасибо', 'Spasibo'], ['Пожалуйста', 'Pozhaluysta'], ['Извините', 'Izvinite'], ['Да', 'Da'], ['Нет', 'Net'], ['Сколько стоит?', "Skol'ko stoit?"], ['Где туалет?', 'Gde tualet?'], ['Счёт, пожалуйста', 'Schyot, pozhaluysta'], ['Помогите!', 'Pomogite!'], ['До свидания', 'Do svidaniya']] },
  Ukrainian: { native: 'Українська', phrases: [['Добрий день', 'Dobryi den'], ['Дякую', 'Dyakuyu'], ['Будь ласка', "Bud' laska"], ['Вибачте', 'Vybachte'], ['Так', 'Tak'], ['Ні', 'Ni'], ['Скільки коштує?', "Skil'ky koshtuye?"], ['Де туалет?', 'De tualet?'], ['Рахунок, будь ласка', "Rakhunok, bud' laska"], ['Допоможіть!', "Dopomozhit'!"], ['До побачення', 'Do pobachennya']] },
  Arabic: { native: 'العربية', phrases: [['مرحبا', 'Marhaban'], ['شكرا', 'Shukran'], ['من فضلك', 'Min fadlak'], ['آسف', 'Āsif'], ['نعم', "Na'am"], ['لا', 'Lā'], ['بكم هذا؟', 'Bikam hādhā?'], ['أين الحمام؟', 'Ayna al-hammām?'], ['الحساب من فضلك', 'Al-hisāb min fadlak'], ['النجدة!', 'An-najda!'], ['مع السلامة', "Ma'a as-salāma"]] },
  Hebrew: { native: 'עברית', phrases: [['שלום', 'Shalom'], ['תודה', 'Toda'], ['בבקשה', 'Bevakasha'], ['סליחה', 'Slicha'], ['כן', 'Ken'], ['לא', 'Lo'], ['כמה זה עולה?', 'Kama ze ole?'], ['איפה השירותים?', 'Eifo ha-sherutim?'], ['חשבון, בבקשה', 'Cheshbon, bevakasha'], ['הצילו!', 'Hatzilu!'], ['להתראות', "Lehitra'ot"]] },
  Japanese: { native: '日本語', phrases: [['こんにちは', 'Konnichiwa'], ['ありがとうございます', 'Arigatō gozaimasu'], ['お願いします', 'Onegaishimasu'], ['すみません', 'Sumimasen'], ['はい', 'Hai'], ['いいえ', 'Iie'], ['いくらですか？', 'Ikura desu ka?'], ['トイレはどこですか？', 'Toire wa doko desu ka?'], ['お会計お願いします', 'Okaikei onegaishimasu'], ['助けて！', 'Tasukete!'], ['さようなら', 'Sayōnara']] },
  Korean: { native: '한국어', phrases: [['안녕하세요', 'Annyeonghaseyo'], ['감사합니다', 'Gamsahamnida'], ['부탁합니다', 'Butakhamnida'], ['죄송합니다', 'Joesonghamnida'], ['네', 'Ne'], ['아니요', 'Aniyo'], ['얼마예요?', 'Eolmayeyo?'], ['화장실이 어디예요?', 'Hwajangsiri eodiyeyo?'], ['계산서 주세요', 'Gyesanseo juseyo'], ['도와주세요!', 'Dowajuseyo!'], ['안녕히 계세요', 'Annyeonghi gyeseyo']] },
  Chinese: { native: '中文', phrases: [['你好', 'Nǐ hǎo'], ['谢谢', 'Xièxie'], ['请', 'Qǐng'], ['对不起', 'Duìbuqǐ'], ['是', 'Shì'], ['不是', 'Bú shì'], ['多少钱？', 'Duōshao qián?'], ['洗手间在哪里？', 'Xǐshǒujiān zài nǎlǐ?'], ['买单', 'Mǎidān'], ['救命！', 'Jiùmìng!'], ['再见', 'Zàijiàn']] },
  Thai: { native: 'ไทย', note: 'Men end polite phrases with “khrap”, women with “kha”.', phrases: [['สวัสดี', 'Sawasdee'], ['ขอบคุณ', 'Khop khun'], ['กรุณา', 'Karuna'], ['ขอโทษ', 'Khor thot'], ['ใช่', 'Chai'], ['ไม่', 'Mai'], ['เท่าไหร่', 'Tao rai?'], ['ห้องน้ำอยู่ที่ไหน', 'Hong nam yoo tee nai?'], ['เช็คบิล', 'Check bin'], ['ช่วยด้วย', 'Chuay duay!'], ['ลาก่อน', 'La gon']] },
  Vietnamese: { native: 'Tiếng Việt', phrases: [['Xin chào'], ['Cảm ơn'], ['Làm ơn'], ['Xin lỗi'], ['Vâng'], ['Không'], ['Bao nhiêu tiền?'], ['Nhà vệ sinh ở đâu?'], ['Tính tiền'], ['Cứu tôi với!'], ['Tạm biệt']] },
  Indonesian: { native: 'Bahasa Indonesia', phrases: [['Halo'], ['Terima kasih'], ['Tolong'], ['Permisi · Maaf'], ['Ya'], ['Tidak'], ['Berapa harganya?'], ['Di mana toilet?'], ['Minta bonnya'], ['Tolong!'], ['Sampai jumpa']] },
  Malay: { native: 'Bahasa Melayu', phrases: [['Helo'], ['Terima kasih'], ['Tolong'], ['Maaf'], ['Ya'], ['Tidak'], ['Berapa harganya?'], ['Di mana tandas?'], ['Minta bil'], ['Tolong!'], ['Selamat tinggal']] },
  Hindi: { native: 'हिन्दी', phrases: [['नमस्ते', 'Namaste'], ['धन्यवाद', 'Dhanyavaad'], ['कृपया', 'Kripya'], ['माफ़ कीजिए', 'Maaf kijiye'], ['हाँ', 'Haan'], ['नहीं', 'Nahin'], ['कितने का है?', 'Kitne ka hai?'], ['शौचालय कहाँ है?', 'Shauchalay kahaan hai?'], ['बिल दीजिए', 'Bill dijiye'], ['बचाओ!', 'Bachao!'], ['फिर मिलेंगे', 'Phir milenge']] },
  Albanian: { native: 'Shqip', phrases: [['Përshëndetje'], ['Faleminderit'], ['Ju lutem'], ['Më falni'], ['Po'], ['Jo'], ['Sa kushton?'], ['Ku është tualeti?'], ['Llogarinë, ju lutem'], ['Ndihmë!'], ['Mirupafshim']] },
  Swahili: { native: 'Kiswahili', phrases: [['Habari · Jambo'], ['Asante'], ['Tafadhali'], ['Samahani'], ['Ndiyo'], ['Hapana'], ['Bei gani?'], ['Choo kiko wapi?'], ['Naomba bili'], ['Msaada!'], ['Kwaheri']] },
};

export function phrasesFor(languages: string[] | undefined): { language: string; set: PhraseSet } | null {
  for (const l of languages ?? []) {
    if (PHRASEBOOK[l]) return { language: l, set: PHRASEBOOK[l] };
  }
  return null;
}
