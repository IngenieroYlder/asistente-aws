const OpenAI = require('openai');
const fs = require('fs');
const { Setting } = require('../database/models');

// We don't cache instance globally anymore, as keys differ per company
// Optimization: Cache instance Map<companyId, OpenAI>

const instances = new Map();

const getOpenAI = async (companyId) => {
    // 1. Check DB for Company Key
    const keySetting = await Setting.findOne({ where: { company_id: companyId, key: 'OPENAI_API_KEY' } });
    let apiKey = keySetting ? keySetting.value : process.env.OPENAI_API_KEY; // Fallback to Global Env

    if (!apiKey) throw new Error("No OpenAI Key configured for this company");

    if (!instances.has(companyId) || instances.get(companyId).apiKey !== apiKey) {
        const instance = new OpenAI({ apiKey });
        instance.apiKey = apiKey;
        instances.set(companyId, instance);
    }
    return instances.get(companyId);
};

exports.getChatCompletion = async (companyId, messages) => {
    try {
        const openai = await getOpenAI(companyId);
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.5,
        });

        // Track Usage
        if (completion.usage) {
            try {
                const { UsageLog } = require('../database/models');
                await UsageLog.create({
                    company_id: companyId,
                    model: 'gpt-4o',
                    tokens_prompt: completion.usage.prompt_tokens,
                    tokens_completion: completion.usage.completion_tokens,
                    date: new Date(),
                    request_type: 'chat'
                });
            } catch (logErr) {
                console.error("[OpenAI] Failed to log usage:", logErr.message);
            }
        }

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Chat Error:", error.message);
        return "Lo siento, hubo un error de configuración de IA.";
    }
};

exports.transcribeAudio = async (filePath, companyId) => {
    try {
        const openai = await getOpenAI(companyId);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
            response_format: "text",
        });
        return transcription;
    } catch (error) {
        console.error("OpenAI Whisper Error:", error.message);
        return null;
    }
};

exports.summarizeSession = async (transcript, companyId) => {
    try {
        const openai = await getOpenAI(companyId);
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Resume esta conversación en 5 líneas." },
                { role: "user", content: transcript }
            ],
        });
        return completion.choices[0].message.content;
    } catch (error) { return null; }
};
