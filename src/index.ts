import OpenAI from 'openai';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
	OPEN_AI_KEY: string;
	AI: Ai;
};
const app = new Hono<{ Bindings: Bindings }>();

app.use(
	'/*',
	cors({
		origin: '*', //Allow requests from your NextJs App
		allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type'],
		//allow content type to the allowed header to fix CORS
		allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
		exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
		maxAge: 600,
		credentials: true,
	})
);

app.post('/translateDocument', async (c) => {
	const { documentData, targetLang } = await c.req.json();

	//Generate a summary of the document
	const summaryResponse = await c.env.AI.run('@cf/facebook/bart-large-cnn', {
		input_text: documentData,
		max_length: 1000,
	});

	//translate the summary into the target language
	const response = await c.env.AI.run('@cf/meta/m2m100-1.2b', {
		text: summaryResponse.summary,
		source_lang: 'english',
		target_lang: targetLang,
	});

	return new Response(JSON.stringify(response));
});

app.post('/chatToDocument', async (c) => {
	const openai = new OpenAI({
		apiKey: c.env.OPEN_AI_KEY,
	});

	const { documentData, question } = await c.req.json();

	const chatCompletion = await openai.chat.completions.create({
		messages: [
			{
				role: 'system',
				content:
					'You are an assistant helping the user chat with a document. Here is the document data as JSON:\n\n' +
					JSON.stringify(documentData) +
					"\n\nUse this data to answer the user's question clearly.",
			},
			{
				role: 'user',
				content: 'My question is ' + question,
			},
		],
		model: 'gpt-4o',
		temperature: 0.5,
	});

	const response = chatCompletion.choices[0].message.content;
	return c.json({ message: response });
});

export default app;

// 'You are a assistant helping the user to chat to the document, I am providing a JSON file of the markdown for the document. Using this , answer the usrs question in the clearest way possible, the document is about ' +
// 					documentData
