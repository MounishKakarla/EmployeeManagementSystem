package com.employee.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseMigrationRunner {

    private final JdbcTemplate jdbcTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void runMigrations() {
        dropTimesheetUniqueConstraintIfExists();
        backfillSickCasualBalance();
    }

    /**
     * The old unique constraint (emp_id, week_start_date, project) on timesheets
     * must be dropped to allow multiple entries per project per week.
     * Safe to run on every startup — does nothing if constraint is already gone.
     */
    private void dropTimesheetUniqueConstraintIfExists() {
        try {
            jdbcTemplate.execute("""
                DO $$
                DECLARE v_name text;
                BEGIN
                    SELECT tc.constraint_name INTO v_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema    = kcu.table_schema
                    WHERE tc.table_name       = 'timesheets'
                      AND tc.constraint_type  = 'UNIQUE'
                      AND kcu.column_name     = 'project'
                    LIMIT 1;
                    IF v_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE timesheets DROP CONSTRAINT ' || quote_ident(v_name);
                        RAISE NOTICE 'Dropped timesheet unique constraint: %', v_name;
                    END IF;
                END $$;
            """);
        } catch (Exception e) {
            log.warn("Could not drop timesheet unique constraint (may already be gone): {}", e.getMessage());
        }
    }

    /**
     * Back-fill sick_casual_total = 10 for any existing leave_balance rows
     * that have sick_casual_total = 0 (created before this feature was added).
     */
    private void backfillSickCasualBalance() {
        try {
            int rows = jdbcTemplate.update(
                "UPDATE leave_balances SET sick_casual_total = 10 WHERE sick_casual_total IS NULL OR sick_casual_total = 0"
            );
            if (rows > 0) {
                log.info("Back-filled sick_casual_total = 10 for {} leave balance row(s)", rows);
            }
        } catch (Exception e) {
            log.warn("Could not back-fill sick_casual_total: {}", e.getMessage());
        }
    }
}
