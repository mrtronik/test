const { execSync } = require('child_process');

class CronService {

    static listJobs() {
        try {
            const output = execSync('crontab -l 2>/dev/null', { encoding: 'utf8', timeout: 10000 });
            const lines = output.split('\n').filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('DO NOT'));
            return lines.map((line, idx) => {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 6) return null;
                return {
                    id: idx,
                    minute: parts[0],
                    hour: parts[1],
                    dayOfMonth: parts[2],
                    month: parts[3],
                    dayOfWeek: parts[4],
                    command: parts.slice(5).join(' '),
                    raw: line.trim()
                };
            }).filter(Boolean);
        } catch {
            return [];
        }
    }

    static addJob(cronExpression, command) {
        const jobs = this.listJobs();
        const newJob = `${cronExpression} ${command}`;

        // Validate cron expression
        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length !== 5) {
            throw new Error('Invalid cron expression. Must have 5 fields: minute hour day month weekday');
        }

        // Add new job
        const allJobs = [...jobs.map(j => j.raw), `# MRPanel Job - ${new Date().toISOString()}`, newJob].join('\n');

        const tmpFile = `/tmp/crontab-${Date.now()}`;
        require('fs').writeFileSync(tmpFile, allJobs + '\n');
        execSync(`crontab "${tmpFile}"`, { timeout: 10000 });
        require('fs').unlinkSync(tmpFile);

        return { success: true };
    }

    static deleteJob(index) {
        const jobs = this.listJobs();
        if (index < 0 || index >= jobs.length) throw new Error('Invalid job index');

        jobs.splice(index, 1);
        const allJobs = jobs.map(j => j.raw).join('\n');

        const tmpFile = `/tmp/crontab-${Date.now()}`;
        require('fs').writeFileSync(tmpFile, allJobs + '\n');
        execSync(`crontab "${tmpFile}"`, { timeout: 10000 });
        require('fs').unlinkSync(tmpFile);

        return { success: true };
    }

    static updateJob(index, cronExpression, command) {
        const jobs = this.listJobs();
        if (index < 0 || index >= jobs.length) throw new Error('Invalid job index');

        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length !== 5) {
            throw new Error('Invalid cron expression');
        }

        jobs[index] = {
            ...jobs[index],
            minute: parts[0],
            hour: parts[1],
            dayOfMonth: parts[2],
            month: parts[3],
            dayOfWeek: parts[4],
            command: command,
            raw: `${cronExpression} ${command}`
        };

        const allJobs = jobs.map(j => j.raw).join('\n');
        const tmpFile = `/tmp/crontab-${Date.now()}`;
        require('fs').writeFileSync(tmpFile, allJobs + '\n');
        execSync(`crontab "${tmpFile}"`, { timeout: 10000 });
        require('fs').unlinkSync(tmpFile);

        return { success: true };
    }

    static listSystemCrons() {
        try {
            const files = require('fs').readdirSync('/etc/cron.d').filter(f => !f.startsWith('.'));
            const jobs = [];
            for (const file of files) {
                try {
                    const content = require('fs').readFileSync(`/etc/cron.d/${file}`, 'utf8');
                    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
                    for (const line of lines) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 6) {
                            jobs.push({
                                file,
                                user: parts[4],
                                schedule: `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}`,
                                command: parts.slice(5).join(' '),
                                raw: line.trim()
                            });
                        }
                    }
                } catch {}
            }
            return jobs;
        } catch {
            return [];
        }
    }

    static parseCronSchedule(minute, hour, dayOfMonth, month, dayOfWeek) {
        const parts = {
            minute: minute === '*' ? 'every minute' : minute.includes('/') ? `every ${minute.split('/')[1]} min` : `at minute ${minute}`,
            hour: hour === '*' ? 'every hour' : hour.includes('/') ? `every ${hour.split('/')[1]} hours` : `at hour ${hour}`,
            day: dayOfMonth === '*' ? '' : `on day ${dayOfMonth}`,
            month: month === '*' ? '' : `in month ${month}`,
            weekday: dayOfWeek === '*' ? '' : `on weekday ${dayOfWeek}`
        };
        return Object.values(parts).filter(Boolean).join(', ');
    }
}

module.exports = CronService;
