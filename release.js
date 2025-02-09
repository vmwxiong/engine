const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');

const releaseBranchName = 'release-';

const printUsage = () => {
    console.log(`\nSpecify the type of operation as an argument. One of:
    create-release - create the next minor release branch '${releaseBranchName}1.XX'. invoke from dev branch.
    finalize-release - finalize the package version and tag the release. invoke from release branch.
`);
};

const exec = (command) => {
    console.log(`exec: '${command}'`);
    return execSync(command).toString().trim();
};

// read package version and return in a structure.
const readPackageVersion = () => {
    const version = require('./package.json').version;
    const versionParts = version.split('-');
    const versionNumbers = versionParts[0].split('.').map((v) => {
        const intV = parseInt(v, 10);
        if (isNaN(intV)) {
            throw new Error(`Unable to parse version '${version}'.`);
        }
        return intV;
    });

    if (versionNumbers.length !== 3) {
        throw new Error(`Unable to parse version '${version}'.`);
    }

    return {
        major: versionNumbers[0],
        minor: versionNumbers[1],
        patch: versionNumbers[2],
        build: versionParts[1] || null
    };
};

// bump package version. releaseType is major, minor or patch
const bumpPackageVersion = (version, releaseType) => {
    switch (releaseType) {
        case 'major':
            return {
                major: version.major + 1,
                minor: 0,
                patch: 0,
                build: version.build
            };
        case 'minor':
            return {
                major: version.major,
                minor: version.minor + 1,
                patch: 0,
                build: version.build
            };
        case 'patch':
            return {
                major: version.major,
                minor: version.minor,
                patch: version.patch + 1,
                build: version.build
            };
    }
};

// this function evolves the package version for releases.
// when a new (minor) release branch is made, the version is tagged as preview build, e.g. '1.48.0-preview'.
// at publish time, this version will evolve to '1.48.0'.
// at next publish time, this version will evolve to '1.48.1'.
// etc
const evolvePackageVersion = (version) => {
    return version.build ? {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        build: null
    } : bumpPackageVersion(version, 'patch');
};

// write package version to package.json
const writePackageVersion = (version) => {
    const packageJson = require('./package.json');
    packageJson.version = `${version.major}.${version.minor}.${version.patch}` + (version.build ? `-${version.build}` : '');
    fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));
};

// ask user a question and invoke callback if user responds yes (using enter, y or Y).
const getUserConfirmation = (question, callback) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(question, (response) => {
        rl.close();

        if (response !== '' && response !== 'y' && response !== 'Y') {
            process.exit(1);
        }

        callback();
    });
};

// create a new release branch.
// assumed called from dev.
// updates package versions on dev and newly created release branch.
const createRelease = () => {
    // get current branch for sanity
    const devBranch = exec('git branch --show-current');
    if (devBranch !== 'dev') {
        // say something?
        console.log(`warning: source branch is not 'dev'.`);
    }

    // read current package version. this contains the version we're releasing.
    const devVersion = readPackageVersion();
    if (devVersion.build !== 'dev') {
        // say something?
        console.warn(`warning: package isn't tagged as 'dev' build.`);
    }

    // build release branch string
    const releaseBranch = `${releaseBranchName}${devVersion.major}.${devVersion.minor}`;
    const releaseMessage = `Branch ${devVersion.major}.${devVersion.minor}`;

    // print summary and get user buy-in
    const question = `About to create minor release branch '${releaseBranch}' taken from '${devBranch}' branch.\nContinue? (Y/n) `;
    getUserConfirmation(question, () => {
        // create branch for the new minor release
        exec(`git branch ${releaseBranch} ${devBranch}`);

        // write next minor version to the dev package
        writePackageVersion(bumpPackageVersion(devVersion, 'minor'));

        // commit with message indicating release branch
        exec(`git commit -a -m "${releaseMessage}"`);

        // checkout release branch
        exec(`git checkout ${releaseBranch}`);

        // update package version build to 'preview'
        writePackageVersion({
            major: devVersion.major,
            minor: devVersion.minor,
            patch: devVersion.patch,
            build: 'preview'
        });

        exec(`git commit -a -m "${releaseMessage}"`);
    });

    return 0;
};

// tag the current branch for release
const finalizeRelease = () => {
    // get current branch, check it's a release branch
    const curBranch = exec('git branch --show-current');
    if (!curBranch.startsWith(releaseBranchName)) {
        console.log(`warning: current branch '${curBranch}' does not start with '${releaseBranchName}'.`);
    }

    // get the current package version
    const curVersion = readPackageVersion();

    // sanity check package version
    if (curVersion.build && curVersion.patch !== 0) {
        console.log(`warning: package version has unexpected build '${curVersion.build}'.`);
    }

    // calculate the new version - either first minor release or patch release
    const newVersion = evolvePackageVersion(curVersion);
    const versionString = `v${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;

    // get user confirmation
    const question = `About to finalize and tag branch '${curBranch}' with version '${versionString}'.\nContinue? (Y/n) `;
    getUserConfirmation(question, () => {
        writePackageVersion(newVersion);

        exec(`git commit -a -m "${versionString}"`);

        exec(`git tag ${versionString}`);
    });
};

// invoke worker depending on command line args
const run = () => {
    if (process.argv.length !== 3) {
        console.log(`This script prepares the engine for release.`);
        printUsage();
        return 1;
    }

    const operation = process.argv[2];
    switch (operation) {
        case 'create-release':
            createRelease();
            return 0;
        case 'finalize-release':
            finalizeRelease();
            return 0;
        default:
            console.error(`Can't recognize operation '${operation}.`);
            printUsage();
            return 1;
    }
};

// install global error handler
process.on('uncaughtException', (err) => {
    console.error(err.message);
    process.exitCode = 1;
});

// run
process.exitCode = run();
