const getNews = async (req, res) => {
    try{
        const url = `https://newsapi.org/v2/everything?q=("Formula 1" OR "Grand Prix" OR F1 OR FIA OR Ferrari OR Red Bull OR McLaren OR Mercedes OR Williams OR Aston Martin OR Alpine OR Haas OR Sauber OR Racing Bulls OR Verstappen OR Hamilton OR Leclerc OR Norris OR Piastri OR Russell)&domains=formula1.com,motorsport.com,autosport.com,the-race.com,racingnews365.com,gpblog.com&language=en&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json()
        const articles = data.articles.map((article, index) => ({
            id: index + 1,
            title: article.title,
            description: article.description,
            image: article.urlToImage || "https://via.placeholder.com/800x450?text=Formula+1+News",
            url: article.url,
            publishedAt: article.publishedAt,
            source: article.source.name,
            author: article.author
        }))
        res.json(articles);}
    catch(error){
        res.status(500).json({message:"Failed to fetch news data"})
    }

};
module.exports = { getNews };