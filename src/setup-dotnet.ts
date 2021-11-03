import * as core from '@actions/core';
import * as installer from './installer';
import * as fs from 'fs';
import * as path from 'path';
import * as auth from './authutil';

export async function run() {
  try {
    //
    // dotnet-version is optional, but needs to be provided for most use cases.
    // If supplied, install / use from the tool cache.
    // If not supplied, look for version in ./global.json.
    // If a valid version still can't be identified, nothing will be installed.
    // Proxy, auth, (etc) are still set up, even if no version is identified
    //
    let versions = core.getMultilineInput('dotnet-version');
    if (!versions.length) {
      // Try to fall back to global.json
      core.debug('No version found, trying to find version from global.json');
      const globalJsonPath = path.join(process.cwd(), 'global.json');
      if (fs.existsSync(globalJsonPath)) {
        versions[0] = getVersionFromGlobalJson(globalJsonPath);
      }
    }

    if (versions) {
      const includePrerelease: boolean =
        (core.getInput('include-prerelease') || 'false').toLowerCase() ===
        'true';

      const dotnetInstaller = new installer.DotnetCoreInstaller(
        versions,
        includePrerelease
      );
      await dotnetInstaller.installDotnet();
    }

    const sourceUrl: string = core.getInput('source-url');
    const configFile: string = core.getInput('config-file');
    if (sourceUrl) {
      auth.configAuthentication(sourceUrl, configFile);
    }

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'csc.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

function getVersionFromGlobalJson(globalJsonPath: string): string {
  let version: string = '';
  const globalJson = JSON.parse(
    // .trim() is necessary to strip BOM https://github.com/nodejs/node/issues/20649
    fs.readFileSync(globalJsonPath, {encoding: 'utf8'}).trim()
  );
  if (globalJson.sdk && globalJson.sdk.version) {
    version = globalJson.sdk.version;
    const rollForward = globalJson.sdk.rollForward;
    if (rollForward && rollForward === 'latestFeature') {
      const [major, minor] = version.split('.');
      version = `${major}.${minor}`;
    }
  }
  return version;
}

run();
