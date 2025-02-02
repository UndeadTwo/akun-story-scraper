import Akun from 'akun-api';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import commandLineArgs from 'command-line-args';
import path from 'path';
import prettyMs from 'pretty-ms';
import {fileURLToPath} from 'url';
import buildTargetList from './buildTargetList.js';
import getStoryList from './getStoryList.js';
import getViewInputList from './getViewInputList.js';
import isFolderStoryArchive from './isFolderStoryArchive.js';
import Logger from './Logger.js';
import Scraper from './Scraper.js';
import buildView from './view/buildView.js';

const logger = new Logger();
const projectRoot = path.join(fileURLToPath(import.meta.url), '..', '..');

const options = commandLineArgs([
	{ name: 'mode', alias: 'm', type: String},
	{ name: 'outputDirectory', alias: 'o', type: String},
	{ name: 'sortType', alias: 's', type: String},
	{ name: 'startPage', alias: 'q', type: Number, defaultValue: 1},
	{ name: 'endPage', alias: 'w', type: Number, defaultValue: 1000},
	{ name: 'skipChat', alias: 'c', type: Boolean, defaultValue: false},
	{ name: 'downloadImages', alias: 'd', type: Boolean, defaultValue: true},
	{ name: 'useSkipList', alias: 'k', type: Boolean, defaultValue: false},
	{ name: 'skipListPath', alias: 'l', type: String},
	{ name: 'useTargetList', alias: 't', type: Boolean, defaultValue: false},
	{ name: 'targetListPath', alias: 'y', type: String},
	{ name: 'target', alias: 'i', type: String},
]);

async function getCredentials() {
	let credentialsJson;
	try {
		credentialsJson = await fs.readFile('credentials.json', 'utf8');
	} catch (err) {
		// File doesn't exist, move on
		return null;
	}
	let credentials;
	try {
		credentials = JSON.parse(credentialsJson);
	} catch (err) {
		logger.error(`credentials.json found but not in valid JSON format`);
		return null;
	}
	if (credentials.username && credentials.password) {
		return credentials;
	} else {
		logger.error(`credentials.json found but doesn't contain both username and password values`);
		return null;
	}
}

async function setCredentials(credentials) {
	await fs.writeFile('credentials.json', JSON.stringify(credentials, null, '\t'), 'utf8');
}

async function confirmCredentials(akun, credentials) {
	let res;
	try {
		res = await akun.login(credentials.username, credentials.password);
	} catch (err) {
		throw new Error(`Unable to login: ${err}`);
	}
	logger.log(`Logged in as ${res['username']}!`);
}

async function start() {
	let mode = options['mode'];

	if(mode === undefined)
	{
		mode = await inquirer.prompt({
			type: 'list',
			name: 'mode',
			message: 'Run in which mode?',
			choices: [
				{
					name: 'Targeted (Archives specific stories)',
					value: 'targeted',
					short: 'Targeted'
				},
				{
					name: 'Scrape (Archives all stories)',
					value: 'scrape',
					short: 'Scrape'
				},
				{
					name: 'Build View (Convert archived data into viewable HTML)',
					value: 'view',
					short: 'Build View'
				}
			]
		})['mode'];
	}

	if (mode === 'view') {
		await view();
		return;
	}

	let credentials = await getCredentials();
	const storedCredentialsFound = !!credentials;
	if (!storedCredentialsFound) {
		console.log('No stored credentials available, please input account details (recommended to use a new dummy account)');
		credentials = await inquirer.prompt([
			{
				type: 'input',
				name: 'username',
				message: 'Username:'
			},
			{
				type: 'password',
				name: 'password',
				message: 'Password:'
			}
		]);
	}
	const akun = new Akun({
		hostname: 'fiction.live'
	});
	await confirmCredentials(akun, credentials);
	if (!storedCredentialsFound) {
		const {saveCredentials} = await inquirer.prompt({
			type: 'confirm',
			name: 'saveCredentials',
			message: 'Store credentials for next time? (Warning: will be stored in plaintext)'
		});
		if (saveCredentials) {
			await setCredentials(credentials);
		}
	}

	let outputDirectory = options['outputDirectory'];

	if(outputDirectory === undefined) {
		outputDirectory = await inquirer.prompt({
			type: 'input',
			name: 'outputDirectory',
			message: 'Output directory for archived data:',
			default: path.join(projectRoot, `data-${Date.now()}`)
		})['outputDirectory'];
	}

	const scraper = new Scraper({
		akun,
		logger,
		outputDirectory
	});

	switch (mode) {
		case 'scrape':
			await scrape(scraper);
			break;
		case 'targeted':
			await targeted(scraper);
			break;
		default:
			throw new Error(`Invalid mode '${mode}' specified`);
	}

	logger.log('\n\nFinished archiving!');
}

async function scrape(scraper) {
	let sortType = options['sortType'];
	let startPage = options['startPage'];
	let endPage = options['endPage'];
	let skipChat = options['skipChat'];
	let downloadImages = options['downloadImages'];
	let useSkipList = options['useSkipList'];

	if(sortType === undefined)
		sortType = await inquirer.prompt([{
		type: 'list',
		name: 'sortType',
		message: 'Sort type (determines the order to archive quests in):',
		choices: [
			{
				name: 'Sort by the newest stories',
				value: Scraper.SORT_MODES.NEW,
				short: 'new'
			},
			{
				name: 'Sort by the latest activity in the story, including chat posts',
				value: Scraper.SORT_MODES.ACTIVE,
				short: 'active'
			},
			{
				name: 'Sort by the latest posted chapter',
				value: Scraper.SORT_MODES.CHAPTER,
				short: 'chapter'
			},
			{
				name: 'Sort by the most commented stories',
				value: Scraper.SORT_MODES.REPLIES,
				short: 'replies'
			},
			{
				name: 'Sort by the most liked stories',
				value: Scraper.SORT_MODES.LIKE,
				short: 'likes'
			},
			{
				name: 'Sort by the most commented stories',
				value: Scraper.SORT_MODES.TOP,
				short: 'top'
			}
		]
	}]);

	if(startPage === undefined)
		startPage = await inquirer.prompt([{
		type: 'input',
		name: 'startPage',
		message: 'Start page:',
		default: 1
	}]);

	if(endPage === undefined)
		endPage = await inquirer.prompt([{
		type: 'input',
		name: 'endPage',
		message: 'End page:',
		default: 1000
	}]);

	if(skipChat === undefined)
		skipChat = await inquirer.prompt([{
		type: 'confirm',
		name: 'skipChat',
		message: 'Skip chat:'
	}]);

	if(downloadImages === undefined)
		downloadImages = await inquirer.prompt([{
		type: 'confirm',
		name: 'downloadImages',
		message: 'Download images:'
	}]);

	if(useSkipList === undefined)
		useSkipList = await inquirer.prompt([{
		type: 'confirm',
		name: 'useSkipList',
		message: 'Use a skip list to avoid archiving specific stories?',
		default: false
	}]);

	let skip = [];
	if(useSkipList) {
		let skipListPath = options['skipListPath'];
		if (skipListPath === undefined) {
			skipListPath = await inquirer.prompt({
				type: 'input',
				name: 'skipListPath',
				message: 'Skip list path:',
				default: path.join(projectRoot, 'skiplist.txt')
			})['skipListPath'];
		}

		skip = await getStoryList(skipListPath);
	}

	await scraper.archiveAllStories({startPage, endPage, skipChat, sortType, skip, downloadImages});
}

async function targeted(scraper) {
	let skipChat = options['skipChat'];
	let useTargetList = options['useTargetList'];
	let downloadImages = options['downloadImages'];

	if(skipChat === undefined)
		skipChat = await inquirer.prompt([{
			type: 'confirm',
			name: 'skipChat',
			message: 'Skip chat:'
		}]);

	if(useTargetList === undefined)
		useTargetList = await inquirer.prompt([{
			type: 'confirm',
			name: 'downloadImages',
			message: 'Download images:'
		}]);

	if(downloadImages === undefined)
		downloadImages = await inquirer.prompt([{
			type: 'confirm',
			name: 'useTargetList',
			message: 'Use a target list to archive specific stories?',
			default: true
		}]);

	let targets;
	if (useTargetList) {
		let targetListPath = options['targetListPath'];

		if(targetListPath === undefined)
			targetListPath = await inquirer.prompt({
				type: 'input',
				name: 'targetListPath',
				message: 'Target list path:',
				default: path.join(projectRoot, 'targetlist.txt')
			})['targetListPath'];

		targets = await buildTargetList(await getStoryList(targetListPath), scraper, logger, skipChat);
	}
	else {
		let target = options['target'];

		if(target === undefined)
			target = await inquirer.prompt({
				type: 'input',
				name: 'target',
				message: 'Target story id (first alphanumeric hash segment from story URL):'
			});

		targets = [{
			storyId: target,
			skipChat
		}];
	}

	for (const {storyId, skipChat, user} of targets) {
		try {
			await scraper.archiveStory({storyId, skipChat, user, downloadImages});
		} catch (err) {
			logger.error(`Unable to archive story ${storyId}: ${err}`);
			await scraper.logFatQuest(storyId);
		}
	}
}

async function view() {

	const dataFolder = (await fs.readdir(projectRoot)).filter(file => file.startsWith('data-')).pop();
	const defaultInputPath = dataFolder && path.join(projectRoot, dataFolder);

	const {mode, inputPath, outputType} = await inquirer.prompt([
		{
			type: 'list',
			name: 'mode',
			message: 'Run in which mode?',
			choices: [
				{
					name: 'Multi (Build views for multiple archives)',
					value: 'multi',
					short: 'Multi'
				},
				{
					name: 'Single (Build view for single archive)',
					value: 'single',
					short: 'Single'
				}
			]
		},
		{
			type: 'input',
			name: 'inputPath',
			message: 'Specify input path:',
			default: defaultInputPath
		},
		{
			type: 'list',
			name: 'outputType',
			message: 'Output files where?',
			choices: [
				{
					name: 'In situ (The new files will be placed in the same folder as the archive files used to generate them)',
					value: 'insitu',
					short: 'In situ'
				},
				{
					name: 'Elsewhere (The new files will be placed in a single folder of your choosing)',
					value: 'elsewhere',
					short: 'Elsewhere'
				}
			]
		}
	]);
	let outputPath;
	if (outputType === 'elsewhere') {
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'outputPath',
				message: 'Specify output path:',
				default: path.join(projectRoot, 'views')
			}
		]);
		outputPath = answers['outputPath'];
	}
	if (mode === 'single') {
		if (await isFolderStoryArchive(inputPath)) {
			await buildView(inputPath, outputPath);
		} else {
			logger.error('Input path did not recognised as an archive');
		}
	} else {
		const inputPaths = await getViewInputList(inputPath);
		if (inputPaths.length) {
			const timeStart = Date.now();
			logger.log('Detected following archives:');
			inputPaths.forEach(input => logger.log(input));
			for (const input of inputPaths) {
				await buildView(input, outputPath);
			}
			const timeElapsed = Date.now() - timeStart;
			console.log(`Built all views in ${prettyMs(timeElapsed)}`);
		} else {
			logger.error(`Couldn't detect any archives within input path`);
		}
	}

}

start().catch(console.error);
