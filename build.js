import showdown from 'showdown';
// import fs from 'fs/promises';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const outputPath = path.join( __dirname, 'docs' );

const converter = new showdown.Converter( {
    omitExtraWLInCodeBlocks: true,

} );

const pathToCheck = path.join( __dirname, 'src', 'md' );
const templatePath = path.join( __dirname, 'src', 'layouts', 'index.html' );

const templateStr = await fs.readFile( templatePath, { encoding: 'utf-8' } );
const template = templateStr.split( '{{ content }}' );

const layoutsPath = path.join( __dirname, 'src', 'layouts' );
const layouts = await fs.readdir( layoutsPath );

await iteratePath( pathToCheck );

async function iteratePath( pathToCheck, relativePath = '' ) {

    for ( const filename of await fs.readdir( pathToCheck ) ) {
    
        const filepath = path.join( pathToCheck, filename );
    
        if( ( await fs.lstat( filepath ) ).isDirectory() ) {
            iteratePath( filepath, path.join( relativePath, filename ) );
            continue;
        }

        // get filename without extensions
        const baseFilename = path.basename( filename, '.md' );
    
        // find layout
        let layoutFilename = layouts.find( e => path.basename( e, '.html' ) == baseFilename );
        if ( !layoutFilename ) layoutFilename = 'template.html';
        const layout = await fs.readFile( path.join( layoutsPath, layoutFilename ), { encoding: 'utf-8'} )
        
        // console.log( 'layout:', layout );

    
        // convert md file to html
        const fileStr = await fs.readFile( path.join( pathToCheck, filename ), { encoding: 'utf-8' } );
        const fileHTML = converter.makeHtml( fileStr );
    
        let newHTML = [ ...layout.split( '{{ content }}' ) ]
        newHTML.splice( 1, 0, fileHTML );
        newHTML = newHTML.join(''); 

        const baseFilenameHTML = baseFilename + '.html';

        const destPath = relativePath == '' ?
            path.join( outputPath, baseFilenameHTML ) :
            path.join( outputPath, relativePath, baseFilenameHTML )
    
        fs.outputFile( destPath, newHTML );
    }

}

