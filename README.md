# Akun Story Scraper

It'll archive stories for you.

If you have no idea what you're doing then just download [this zip](https://github.com/Fiddlekins/akun-story-scraper/releases/download/1.6.0/akun-story-scraper.1.6.0.zip) and extract it in a nice friendly location like your desktop.

Otherwise clone the project, do an npm install, it's pretty standard.

If you're on windows just run `run.cmd` and follow the prompts.

If you're on linux then run the tool with `node index.js` or `npm run start`.

If you're running this in targeted mode or scrape mode with a skip list then you'll need to figure out the ID for the stories you wish to archive

This can be done simply by examining the story URL.

In this example URL:
```
https://fiction.live/stories/Star-Wars-TR-8R-Quest/Bguh5zu7gX3nyYrXk/Mission-18-The-Price-of-Theft-/yvFfTTSQbH2o34vgW
```
the story ID is
```
Bguh5zu7gX3nyYrXk
```

(it's the alphanumeric text that follows the story title, but (if applicable) comes before the chapter title)

Added command line arguments are

```
--mode ['view','scrape','targeted']
--outputDirectory
--sortType ['new', 'active', 'chapter', 'replies', 'like', 'top']
--startPage Integer, 1-1000+
--endPage Integer, 1-1000+
--skipChat Boolean, false by default
--downloadImages Boolean, true by default
--useSkipList Boolean, false by default
--skipListPath Path to Skip List
--useTargetList Boolean, false by default
--targetListPath Path to Target List
--target Target Quest ID
```
