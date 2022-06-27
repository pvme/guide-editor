import { publish } from 'gh-pages';


publish(
    'dist', // path to public directory
    {
        branch: 'gh-pages',
        repo: 'https://github.com/Towsti/editor-sveltekit.git', // Update to point to your repository
        user: {
            name: 'autobuild'
            // name: 'Towsti', // update to use your name
            // email: 'Towsti1@gmail.com' // Update to use your email
        },
        // dotfiles: true
    },
    () => {
        console.log('Deploy Complete!');
    }
);