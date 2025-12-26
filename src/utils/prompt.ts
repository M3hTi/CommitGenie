import * as readline from 'readline';

export function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export async function promptWithDefault(
  question: string,
  defaultValue: string
): Promise<string> {
  const answer = await prompt(`${question} [${defaultValue}]: `);
  return answer || defaultValue;
}
