# Germany Bundestag Election 2025 vote analysis

## [Blog Post](https://samuelscheit.com/blog/2025/bundestagswahl)

<a href="https://samuelscheit.com/blog/2025/bundestagswahl">
  <img src="https://github.com/user-attachments/assets/7ee9c966-2417-4c47-b66c-20d167ee1c99" height="500" />
  <img src="https://github.com/user-attachments/assets/44626f4a-b965-4d80-89f3-c5c69896e979" height="500" />
</a>

<a href="https://www.bundeswahlleiterin.de/bundestagswahlen/2025/fakten-desinformation.html#35f7a3f4-df1d-4446-a98e-bd4179d381bf">
  <img src="https://github.com/user-attachments/assets/b4142bd2-615c-44a8-8c83-2b19b2aeccaf" width="400" />
</a>

## Install and usage instructions 

1.  Get the sources with
    `git clone https://github.com/SamuelScheit/bundestagswahl2025/`
2.  Change into the directory with `cd bundestagswahl2025`
3.  Install the JavaScript runtime and toolkit [Bun](https://bun.sh/)
    a)  Without the install script, it would be `npm install bun` and
        `export PATH=/path/to/bundestagswahl2025/node_modules/.bin/:$PATH`
4.  Install the dependencies with `bun install` (in some installs it is `bun.exe`)

Now, in `wahlbezirke/download.ts`, you can edit the variable `test` to select
the *Wahlkreise*, you want to download. The assignment below is going to
download all *Wahlkreise*. Then, execute the script 

    bun wahlbezirke/download.ts

The result is stored in `wahlbezirke/data/out.json`.

Now you can compare it with the data from the Bundeswahleiterin with the command
below.

    bun compare.ts

This outputs a table with the differences, and a table with the summary.
