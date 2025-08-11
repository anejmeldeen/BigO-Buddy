// backend/server.ts
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const TMP_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

function runCode(language: string, code: string, callback: (err: string | null, runtime: number | null, output: string) => void) {
    const filenameMap: Record<string, string> = {
        python: 'main.py',
        java: 'Main.java',
        cpp: 'main.cpp'
    };

    const runCmdMap: Record<string, string> = {
        python: `python3 ${filenameMap.python}`,
        java: `javac ${filenameMap.java} && java Main`,
        cpp: `g++ ${filenameMap.cpp} -o main && ./main`
    };

    const filePath = path.join(TMP_DIR, filenameMap[language]);
    fs.writeFileSync(filePath, code);

    const start = process.hrtime();
    exec(runCmdMap[language], { cwd: TMP_DIR, timeout: 5000 }, (err: { message: any; }, stdout: string, stderr: any) => {
        const end = process.hrtime(start);
        const runtimeMs = end[0] * 1000 + end[1] / 1e6;
        if (err) {
            callback(stderr || err.message, null, stdout);
        } else {
            callback(null, runtimeMs, stdout);
        }
    });
}

app.post('/analyze/:lang', (req: { params: { lang: any; }; body: { code: any; }; }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { error: string; }): any; new(): any; }; }; json: (arg0: { error?: string; output: string; runtimeMs?: number | null; analysis?: string; }) => void; }) => {
    const lang = req.params.lang;
    const code = req.body.code;
    if (!['python', 'java', 'cpp'].includes(lang)) {
        return res.status(400).json({ error: 'Invalid language' });
    }

    runCode(lang, code, (err, runtime, output) => {
        if (err) {
            return res.json({ error: err, output });
        }
        res.json({
            runtimeMs: runtime,
            output,
            analysis: `Code executed in ${runtime?.toFixed(2)} ms.`
        });
    });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
