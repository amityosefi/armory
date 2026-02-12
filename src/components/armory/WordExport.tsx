import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, BorderStyle, TextRun, HeightRule } from "docx";
import { saveAs } from "file-saver";

type ArmoryItem = {
    id: number;
    name: string;
    kind: string;
    location: string;
};

type PersonData = {
    id: string;
    name: string;
    items: ArmoryItem[];
};

export const exportToWord = async (
    peopleData: PersonData[],
    selectedSheetName: string
) => {
    const itemsPerPage = 4;
    const sections: any[] = [];

    // Filter people who have weapons or sights (excluding magazines and מטול צד M4)
    const filteredPeople = peopleData.filter(person => {
        return person.items.some(item => 
            (item.kind === 'נשק' || item.kind === 'כוונת') && 
            item.name !== 'מאג' && 
            item.name !== 'מטול צד M4'
        );
    });

    // Process in chunks of 4 items per page
    for (let i = 0; i < filteredPeople.length; i += itemsPerPage) {
        const pageItems = filteredPeople.slice(i, i + itemsPerPage);
        
        // Create rows for the page (2 rows, 2 columns each)
        const rows: TableRow[] = [];
        
        for (let rowIndex = 0; rowIndex < 2; rowIndex++) {
            const rowCells: TableCell[] = [];
            
            // Right column (index 0 or 2)
            const rightIndex = rowIndex * 2;
            if (rightIndex < pageItems.length) {
                const person = pageItems[rightIndex];
                const counter = i + rightIndex + 1;
                rowCells.push(createPersonCell(person, counter, selectedSheetName));
            } else {
                rowCells.push(new TableCell({ 
                    children: [new Paragraph("")],
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0 },
                        bottom: { style: BorderStyle.NONE, size: 0 },
                        left: { style: BorderStyle.NONE, size: 0 },
                        right: { style: BorderStyle.NONE, size: 0 },
                    }
                }));
            }
            
            // Left column (index 1 or 3)
            const leftIndex = rowIndex * 2 + 1;
            if (leftIndex < pageItems.length) {
                const person = pageItems[leftIndex];
                const counter = i + leftIndex + 1;
                rowCells.push(createPersonCell(person, counter, selectedSheetName));
            } else {
                rowCells.push(new TableCell({ 
                    children: [new Paragraph("")],
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0 },
                        bottom: { style: BorderStyle.NONE, size: 0 },
                        left: { style: BorderStyle.NONE, size: 0 },
                        right: { style: BorderStyle.NONE, size: 0 },
                    }
                }));
            }
            
            rows.push(new TableRow({
                children: rowCells,
                height: { value: 3500, rule: HeightRule.ATLEAST }
            }));
        }

        // Create the page table
        const pageTable = new Table({
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
                insideHorizontal: { style: BorderStyle.NONE, size: 0 },
                insideVertical: { style: BorderStyle.NONE, size: 0 },
            }
        });

        sections.push({
            children: [pageTable]
        });
    }

    // Create the document
    const doc = new Document({
        sections: sections.map(section => ({
            properties: {
                page: {
                    margin: {
                        top: 720,
                        right: 720,
                        bottom: 720,
                        left: 720,
                    }
                }
            },
            children: section.children
        }))
    });

    // Generate and save the document
    const blob = await Packer.toBlob(doc);
    const date = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
    saveAs(blob, `${selectedSheetName}_${date}.docx`);
};

function createPersonCell(person: PersonData, counter: number, selectedSheetName: string): TableCell {
    // Get weapons and sights (excluding magazines)
    const weapons = person.items.filter(item => 
        item.kind === 'נשק' && item.name !== 'מאג'
    );
    const sights = person.items.filter(item => 
        item.kind === 'כוונת' && item.name !== 'מאג'
    );

    // Build the content lines
    const contentLines: Paragraph[] = [];
    
    // Add header with sheet name
    contentLines.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: selectedSheetName,
                    bold: true,
                    size: 24,
                })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 }
        })
    );

    contentLines.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `שם חייל: ${person.name}`,
                    size: 22,
                })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 50 }
        })
    );

    contentLines.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `מ.א: ${person.id}`,
                    size: 22,
                })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 50 }
        })
    );

    // Add weapons - use item.name and item.id
    weapons.forEach(weapon => {
        contentLines.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${weapon.name}: ${weapon.id}`,
                        size: 22,
                    })
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 50 }
            })
        );
    });

    // Add sights
    sights.forEach(sight => {
        contentLines.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `כוונת: ${sight.name}`,
                        size: 22,
                    })
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 50 }
            })
        );
    });

    // Add centered counter number after sights (without border)
    contentLines.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: counter.toString(),
                    bold: true,
                    size: 48,
                })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 50 }
        })
    );

    // Create inner table with 2 equal squares: content and counter
    const innerTable = new Table({
        rows: [
            new TableRow({
                children: [
                    // Counter cell (left square)
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: counter.toString(),
                                        bold: true,
                                        size: 96,
                                    })
                                ],
                                alignment: AlignmentType.CENTER,
                            })
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        verticalAlign: "center",
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 6 },
                            bottom: { style: BorderStyle.SINGLE, size: 6 },
                            left: { style: BorderStyle.SINGLE, size: 6 },
                            right: { style: BorderStyle.SINGLE, size: 6 },
                        }
                    }),
                    // Content cell (right square)
                    new TableCell({
                        children: contentLines,
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 6 },
                            bottom: { style: BorderStyle.SINGLE, size: 6 },
                            left: { style: BorderStyle.SINGLE, size: 6 },
                            right: { style: BorderStyle.SINGLE, size: 6 },
                        },
                        margins: {
                            top: 100,
                            bottom: 100,
                            left: 100,
                            right: 100,
                        }
                    })
                ],
                height: { value: 3000, rule: HeightRule.ATLEAST }
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.NONE, size: 0 },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
            insideHorizontal: { style: BorderStyle.NONE, size: 0 },
            insideVertical: { style: BorderStyle.NONE, size: 0 },
        }
    });

    return new TableCell({
        children: [innerTable],
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.NONE, size: 0 },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
        },
        margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50,
        }
    });
}
