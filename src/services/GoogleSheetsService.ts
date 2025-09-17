import {DEFAULT_SPREADSHEET_ID} from "@/constants";
import { sheetGroups } from "@/constants";

type SheetData = {
    title: string;
    data: {
        rowData: any[];
    }[];
};

class GoogleSheetsService {

    static async fetchSheetData(accessToken: string, range: string, isArmory: boolean | undefined) {
        try {
            const defaultSpreadSheet = isArmory || isArmory === undefined ? DEFAULT_SPREADSHEET_ID : DEFAULT_SPREADSHEET_ID;
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${defaultSpreadSheet}/values/${range}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('googleAuthToken');
                    window.location.href = '/';
                }
                console.log('Failed to fetch data');
                return false;
            }
            return await response.json();
        } catch (error) {
            console.log('Error fetching sheet data:', error);
            return false;
        }
    }


    static async fetchAllSheetData(
        accessToken: string
    ): Promise<SheetData[]> {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}?includeGridData=true`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
        }
        console.log('Fetching all sheets data...4');
        const json = await response.json();
        console.log('json');

        if (!json.sheets || !Array.isArray(json.sheets)) {
            throw new Error("Invalid sheets data");
        }

        const result: SheetData[] = json.sheets.map((sheet: any) => ({
            title: sheet.properties.title,
            data: sheet.data || [],
        }));

        return result;
    }




    static async appendSheetData(accessToken: string, range: string, values: any[][]) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`
        console.log("url works: ", url);
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({values})
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                alert("רענן את הדף לצורך התחברות נוספת");
            }
            const errorData = await response.json();
            console.error('Failed to append data:', errorData);
        }

        return await response.json();
    }

    static processSheetData(data: any) {
        if (!data.values || data.values.length === 0) {
            return {columnDefs: [], rowData: []};
        }

        const headers = data.values[0];

        // Create column definitions for AG Grid
        const columnDefs = headers.map((header: string) => ({
            headerName: header,
            field: header.toLowerCase().replace(/\s+/g, '_'),
            sortable: true,
            filter: true,
            resizable: true
        }));

        // Create row data from the values
        const rowData = data.values.slice(1).map((row: any[]) => {
            const rowData: Record<string, any> = {};
            headers.forEach((header: string, index: number) => {
                rowData[header.toLowerCase().replace(/\s+/g, '_')] = row[index] || '';
            });
            return rowData;
        });

        return {columnDefs, rowData};
    }

static async searchAcrossAllSheets({
    searchValue,
    accessToken,
}: {
    searchValue: string;
    accessToken: string;
}) {
    const matches: {
        sheetName: string;
        cellValue: string;
        rowIndex: number; // 1-based row index (excluding header)
    }[] = [];

    const sheetTitles = sheetGroups
        .filter(groupname => groupname.name === 'נשקיה' || groupname.name === 'פלוגות')
        .flatMap((group) =>
        group.sheets.map((sheet) => sheet.range)
    );

    console.log("Searching in sheets:", sheetTitles);

    const rangesParam = sheetTitles.map((title) => `ranges=${encodeURIComponent(title)}`).join("&");

    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}/values:batchGet?${rangesParam}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        }
    );

    const data = await response.json();

    if (data.valueRanges && Array.isArray(data.valueRanges)) {
        for (const valueRange of data.valueRanges) {
            const sheetName = valueRange.range.split("!")[0];
            const rows = valueRange.values || [];

            // Skip header (index 0)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];

                row.forEach((cellValue: string) => {
                    if (
                        typeof cellValue === "string" &&
                        cellValue.toLowerCase().includes(searchValue.toLowerCase())
                    ) {
                        matches.push({
                            sheetName,
                            cellValue,
                            rowIndex: i - 1,
                        });
                    }
                });
            }
        }
    }

    return matches;
}


    static async updateCalls({
                                 accessToken,
                                 updates,
                                 appendSheetId,
                                 appendValues,
                                 secondAppendSheetId,
                                 secondAppendValues,
                                 isArmory
                             }: {
        accessToken: string;
        updates: {
            sheetId: number;
            rowIndex: number;
            colIndex: number;
            value: string;
        }[] | any;
        appendSheetId?: number;
        appendValues?: string[][];
        secondAppendSheetId?: number;
        secondAppendValues?: string[][];
        isArmory?: boolean
    }) {

        try {
            const defaultSpreadSheet = isArmory ? DEFAULT_SPREADSHEET_ID : DEFAULT_SPREADSHEET_ID;

            const requests: any[] = [];
            // Add updateCells requests
            for (const update of updates) {
                const sheetId = update.sheetId;
                if (sheetId === undefined) {
                    throw new Error(`Sheet not found: ${update.sheetId}`);
                }

                requests.push({
                    updateCells: {
                        rows: [
                            {
                                values: [
                                    {
                                        userEnteredValue: {stringValue: update.value},
                                    },
                                ],
                            },
                        ],
                        fields: "userEnteredValue",
                        start: {
                            sheetId,
                            rowIndex: update.rowIndex,
                            columnIndex: update.colIndex,
                        },
                    },
                });
            }
            if (appendValues !== undefined && appendValues !== undefined) {
                requests.push({
                    appendCells: {
                        sheetId: appendSheetId,
                        rows: appendValues.map((row) => ({
                            values: row.map((cell) => ({
                                userEnteredValue: {stringValue: cell},
                            })),
                        })),
                        fields: "*",
                    },
                });
            }
            // Append to second sheet if provided
            if (secondAppendSheetId !== undefined && secondAppendValues !== undefined) {
                requests.push({
                    appendCells: {
                        sheetId: secondAppendSheetId,
                        rows: secondAppendValues.map((row) => ({
                            values: row.map((cell) => ({
                                userEnteredValue: {stringValue: cell},
                            })),
                        })),
                        fields: "*",
                    },
                });
            }

            const res = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${defaultSpreadSheet}:batchUpdate`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({requests}),
                }
            );

            if (!res.ok) {
                if (res.status === 401) {
                    alert("רענן את הדף לצורך התחברות נוספת ובצע את הפעולה שנית");
                }
                const error = await res.json();
                console.log(`Failed to update/append: ${JSON.stringify(error)}`)
                return false;
            }
            console.log("✅ Batch update and append successful");
            return true;
        }catch (error) {
            console.log("Error during batch update/append:", error);
            return false;
        }
    }


    static async batchAppendRowsToSheets({
                                                      accessToken,
                                                      updates,
                                                  }: {
        accessToken: string;
        updates: {
            range: string;
            values: any[][];
        }[];
    }){
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}/values:append`;

        const payload = {
            valueInputOption: "USER_ENTERED",
            data: updates.map(update => ({
                range: update.range,
                values: update.values,
            })),
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            console.log(`Failed to batch update sheets: ${JSON.stringify(error)}`);
            return false;
        }
        console.log(`✅ Successfully executed batch update with ${response} operations`);
        return true;

    }


    static columnIndexToLetter(index: number): string {
        let letter = '';
        let temp = index + 1;
        while (temp > 0) {
            const mod = (temp - 1) % 26;
            letter = String.fromCharCode(65 + mod) + letter;
            temp = Math.floor((temp - mod) / 26);
        }
        return letter;
    }

    /**
     * Executes multiple operations in a single batch update
     * @param accessToken - Google API access token
     * @param requests - Array of request objects for the batch update
     * @returns Promise<boolean> - True if successful, false otherwise
     */
    static async executeBatchUpdate(
        accessToken: string,
        requests: any[]
    ): Promise<boolean> {
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}:batchUpdate`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ requests }),
            }
        );

        if (!res.ok) {
            const error = await res.json();
            console.error(`Failed to execute batch update: ${JSON.stringify(error)}`);
            return false;
        }

        console.log(`✅ Successfully executed batch update with ${requests.length} operations`);
        return true;
    }

    static generatePaddedArray(colIndex: number, value: string): string[] {
        const result = new Array(colIndex + 1).fill("");
        result[colIndex] = value;
        return result;
    }

    static findInsertIndex(data: string[][], headerName: string): { row: number, col: number } {
        const headerRow = data[0];
        const colIndex = headerRow.indexOf(headerName);

        if (colIndex === -1) {
            throw new Error(`Header "${headerName}" not found`);
        }

        for (let row = 1; row < data.length; row++) {
            const rowData = data[row];
            if (!rowData[colIndex] || rowData[colIndex].trim() === '') {
                return { row, col: colIndex };
            }
        }

        // If no empty cell found, insert at new row
        return { row: data.length, col: colIndex };
    }

    static findValuesUnderHeader(
        data: any[][],
        headerName: string
    ): { rowIndex: number; colIndex: number; value: any }[] {
        const result: { rowIndex: number; colIndex: number; value: any; }[] = [];

        if (!data || data.length === 0) return result;

        const headerRow = data[0];
        const colIndex = headerRow.indexOf(headerName);
        if (colIndex === -1) return result;

        for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            if (row && row.length > colIndex) {
                const val = row[colIndex];
                if (val !== '' && val !== null && val !== undefined) {
                    result.push({ rowIndex, colIndex, value: val });
                }
            }
        }

        return result;
    }
}

export default GoogleSheetsService;
