import showdown from 'showdown';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );

const converter = new showdown.Converter({
    omitExtraWLInCodeBlocks: true,

});

const pathToCheck = path.join( __dirname, 'src', 'md' );
const templatePath = path.join( __dirname, 'src', 'html', 'template.html' );

const templateStr = await fs.readFile( templatePath, { encoding: 'utf-8' } );
const template = templateStr.split( '{{ content }}' );

for ( const filename of await fs.readdir( pathToCheck ) ) {
    const fileStr = await fs.readFile( path.join( pathToCheck, filename ), { encoding: 'utf-8' } );
    const fileHTML = converter.makeHtml( fileStr );

    let newHTML = [...template]
    newHTML.splice( 1, 0, fileHTML );

    fs.writeFile( path.join( __dirname, 'src', path.basename( filename, '.md' ) + '.html' ), newHTML );
}
